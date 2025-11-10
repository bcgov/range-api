//
// MyRA
//
// Copyright © 2018 Province of British Columbia
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Created by Jason Leach on 2018-05-10.
//

'use strict';

import { flatten } from 'lodash';
import { errorWithCode } from '@bcgov/nodejs-common-utils';
import Schedule from './grazingschedule';
import Model from './model';
import Pasture from './pasture';
import PlanStatus from './planstatus';
import MinisterIssue from './ministerissue';
import PlanStatusHistory from './planstatushistory';
import PlanConfirmation from './planconfirmation';
import User from './user';
import InvasivePlantChecklist from './invasiveplantchecklist';
import AdditionalRequirement from './additionalrequirement';
import ManagementConsideration from './managementconsideration';
import PlantCommunity from './plantcommunity';
import IndicatorPlant from './indicatorplant';
import MonitoringArea from './monitoringarea';
import MonitoringAreaPurpose from './monitoringareapurpose';
import PlantCommunityAction from './plantcommunityaction';
import GrazingScheduleEntry from './grazingscheduleentry';
import HayCuttingScheduleEntry from './haycuttingscheduleentry';
import MinisterIssueAction from './ministerissueaction';
import MinisterIssuePasture from './ministerissuepasture';
import PlanSnapshot from './plansnapshot';
import Agreement from './agreement';
import PlanFile from './PlanFile';
import PlanExtensionRequests from './planextensionrequests';
import { PLAN_EXTENSION_STATUS } from '../../../constants';

export default class Plan extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (Plan.fields.indexOf(`${Plan.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.status = new PlanStatus(PlanStatus.extract(data), db);
    this.requestedExtension = data.extension_requests_requested_extension;
    this.requestedExtensionUserId = data.extension_requests_user_id;
    this.creator = new User(User.extract(data), db);
    this.planExtensionRequests = new PlanExtensionRequests(PlanExtensionRequests.extract(data), db);
  }

  static legalStatuses = [20, 8, 9, 12, 21];

  static get fields() {
    // TODO:(jl) Work with consumers to remove 'agreement_id' from the selected
    // fields.

    // primary key *must* be first!
    return [
      'id',
      'range_name',
      'plan_start_date',
      'plan_end_date',
      'notes',
      'alt_business_name',
      'agreement_id',
      'status_id',
      'uploaded',
      'amendment_type_id',
      'created_at',
      'updated_at',
      'effective_at',
      'submitted_at',
      'creator_id',
      'canonical_id',
      'is_restored',
      'conditions',
      'proposed_conditions',
      'extension_status',
      'extension_required_votes',
      'extension_received_votes',
      'replacement_of',
      'extension_date',
      'extension_rejected_by',
      'replacement_plan_id',
    ].map((f) => `${Plan.table}.${f}`);
  }

  static get table() {
    return 'plan';
  }

  static async findCurrentVersion(db, canonicalId) {
    try {
      const {
        rows: [currentVersion],
      } = await db.raw(
        `
        SELECT plan.*
        FROM plan_version
        INNER JOIN plan ON plan_version.plan_id = plan.id
        WHERE plan_version.canonical_id = ? AND version = -1;
        `,
        [canonicalId],
      );
      return currentVersion;
    } catch (e) {
      return null;
    }
  }

  static async findWithStatusExtension(db, where, order, page = undefined, limit = undefined, whereNot = undefined) {
    const myFields = [
      ...Plan.fields,
      ...PlanStatus.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
      ...User.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
    ];
    let results = [];
    const q = db
      .select(myFields)
      .from(Plan.table)
      .join('ref_plan_status', { 'plan.status_id': 'ref_plan_status.id' })
      // left join otherwise if extension is NULL we don't get any results
      .join('user_account', { 'plan.creator_id': 'user_account.id' })
      .where({ ...where, uploaded: true })
      .orderBy(...order);

    if (whereNot) {
      results = q.andWhere(...whereNot);
    }

    if (page && limit) {
      const offset = limit * (page - 1);
      results = await q.offset(offset).limit(limit);
    } else {
      results = await q;
    }
    return results.map((row) => new Plan(row, db));
  }

  // Fetch the Agreement ID associated with a given Plan
  static async agreementIdForPlanId(db, planId) {
    if (!db || !planId) {
      return [];
    }

    const results = await db.select('agreement_id').from(Plan.table).where({ id: planId });

    if (results.length === 0) return null;

    const [result] = results;
    return result.agreement_id;
  }

  // Fetch the Agreement ID associated with a given Plan
  static async agreementForPlanId(db, planId) {
    if (!db || !planId) {
      return [];
    }

    const results = await db
      .select('*')
      .from(Plan.table)
      .join(Agreement.table, {
        'plan.agreement_id': 'agreement.forest_file_id',
      })
      .where({ id: planId });

    if (results.length === 0) return null;

    const [result] = results;
    return result;
  }

  static async createSnapshot(db, planId, user) {
    const [plan] = await Plan.findWithStatusExtension(db, { 'plan.id': planId }, ['id', 'desc']);
    if (!plan) {
      throw errorWithCode("Plan doesn't exist: " + planId, 404);
    }
    const { agreementId } = plan;

    const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(db, {
      forest_file_id: agreementId,
    });
    await agreement.eagerloadAllOneToManyExceptPlan();
    agreement.transformToV1();

    await plan.eagerloadAllOneToMany();
    plan.agreement = agreement;

    const {
      rows: [{ max: lastVersion }],
    } = await db.raw(
      `
      SELECT MAX(version) FROM plan_snapshot
      WHERE plan_id = ?
    `,
      [plan.id],
    );

    const snapshotRecord = await PlanSnapshot.create(
      db,
      {
        snapshot: plan,
        plan_id: planId,
        created_at: new Date(),
        version: lastVersion + 1,
        status_id: plan.statusId,
        user_id: user.id,
      },
      user,
    );
    return snapshotRecord;
  }

  static async restoreVersion(db, planId, snapshotVersion, preserverHistory = false) {
    const planSnapshot = await PlanSnapshot.findOne(db, {
      plan_id: planId,
      version: snapshotVersion,
    });

    if (!planSnapshot) {
      throw errorWithCode(`Snapshot for plan ${planId}, version: ${snapshotVersion} does not exist.`, 404);
    }

    const { snapshot } = planSnapshot;

    await Plan.update(db, { id: planId }, { ...snapshot, isRestored: true });

    await Pasture.remove(db, { plan_id: planId });
    const pasturePromises = snapshot.pastures.map(async (pasture) => {
      const newPasture = await Pasture.create(db, pasture);

      await PlantCommunity.remove(db, { pasture_id: pasture.id });

      const plantCommunityPromises = pasture.plantCommunities.map(async (plantCommunity) => {
        const newPlantCommunity = await PlantCommunity.create(db, plantCommunity);

        await IndicatorPlant.remove(db, {
          plant_community_id: plantCommunity.id,
        });

        const indicatorPlantPromises = plantCommunity.indicatorPlants.map(async (indicatorPlant) => {
          const newIndicatorPlant = await IndicatorPlant.create(db, indicatorPlant);

          return newIndicatorPlant;
        });

        const newIndicatorPlants = await Promise.all(indicatorPlantPromises);

        await MonitoringArea.remove(db, {
          plant_community_id: plantCommunity.id,
        });

        const monitoringAreaPromises = plantCommunity.monitoringAreas.map(async (monitoringArea) => {
          const newMonitoringArea = await MonitoringArea.create(db, monitoringArea);

          await MonitoringAreaPurpose.remove(db, {
            monitoring_area_id: monitoringArea.id,
          });

          const purposePromises = monitoringArea.purposes.map(async (purpose) => {
            const newPurpose = await MonitoringAreaPurpose.create(db, purpose);

            return newPurpose;
          });

          const newPurposes = await Promise.all(purposePromises);

          return {
            ...newMonitoringArea,
            monitoringAreaPurposes: newPurposes,
          };
        });

        const newMonitoringAreas = await Promise.all(monitoringAreaPromises);

        await PlantCommunityAction.remove(db, {
          plant_community_id: plantCommunity.id,
        });

        const actionPromises = plantCommunity.plantCommunityActions.map(async ({ ...action }) => {
          const newAction = await PlantCommunityAction.create(db, {
            ...action,
          });

          return newAction;
        });

        const newActions = await Promise.all(actionPromises);

        return {
          ...newPlantCommunity,
          indicatorPlants: newIndicatorPlants,
          monitoringAreas: newMonitoringAreas,
          plantCommunityActions: newActions,
        };
      });

      const newPlantCommunities = await Promise.all(plantCommunityPromises);

      return {
        ...newPasture,
        plantCommunities: newPlantCommunities,
        original: pasture,
      };
    });

    const newPastures = await Promise.all(pasturePromises);

    await Schedule.remove(db, { plan_id: planId });
    await Promise.all(
      snapshot.schedules.map(async (schedule) => {
        const newSchedule = await Schedule.create(db, schedule);

        await Promise.all([
          GrazingScheduleEntry.remove(db, { grazing_schedule_id: schedule.id }),
          HayCuttingScheduleEntry.remove(db, { haycutting_schedule_id: schedule.id }),
        ]);
        const scheduleEntryCreator = Schedule.scheduleEntryCreators[snapshot.agreement.agreementTypeId];
        const scheduleEntries = await Promise.all(
          (schedule.scheduleEntries || [])
            .map((entry) => {
              if (!scheduleEntryCreator) return null;
              const entryWithScheduleId =
                scheduleEntryCreator === GrazingScheduleEntry
                  ? { ...entry, grazing_schedule_id: newSchedule.id }
                  : { ...entry, haycutting_schedule_id: newSchedule.id };
              return scheduleEntryCreator.create(db, entryWithScheduleId);
            })
            .filter(Boolean),
        );
        return {
          ...newSchedule,
          scheduleEntries,
        };
      }),
    );

    await AdditionalRequirement.remove(db, { plan_id: planId });

    const additionalRequirementPromises = snapshot.additionalRequirements.map(async (requirement) => {
      const newRequirement = await AdditionalRequirement.create(db, requirement);

      return newRequirement;
    });

    await Promise.all(additionalRequirementPromises);

    await MinisterIssue.remove(db, { plan_id: planId });

    const ministerIssuePromises = snapshot.ministerIssues.map(async (issue) => {
      const newIssue = await MinisterIssue.create(db, issue);

      await MinisterIssueAction.remove(db, { issue_id: issue.id });

      const actionPromises = issue.ministerIssueActions.map(async (action) => {
        const newAction = await MinisterIssueAction.create(db, action);

        return newAction;
      });

      const newActions = await Promise.all(actionPromises);

      await MinisterIssuePasture.remove(db, { minister_issue_id: issue.id });

      const ministerPasturePromises = issue.pastures.map(async (pastureId) => {
        const pasture = newPastures.find((p) => p.original.id === pastureId);
        const newPasture = await MinisterIssuePasture.create(db, {
          pasture_id: pasture.id,
          minister_issue_id: newIssue.id,
        });

        return newPasture;
      });

      const newMinisterPastures = await Promise.all(ministerPasturePromises);

      return {
        ...newIssue,
        ministerIssueActions: newActions,
        ministerIssuePastures: newMinisterPastures,
      };
    });

    await Promise.all(ministerIssuePromises);

    await ManagementConsideration.remove(db, { plan_id: planId });

    const managementConsiderationPromises = snapshot.managementConsiderations.map(async (consideration) => {
      const newConsideration = await ManagementConsideration.create(db, consideration);

      return newConsideration;
    });

    await Promise.all(managementConsiderationPromises);

    await PlanConfirmation.remove(db, { plan_id: planId });

    const confirmationPromises = snapshot.confirmations.map(async (confirmation) => {
      const newConfirmation = await PlanConfirmation.create(db, confirmation);

      return newConfirmation;
    });

    await Promise.all(confirmationPromises);

    if (snapshot.invasivePlantChecklist && snapshot.invasivePlantChecklist.planId) {
      await InvasivePlantChecklist.remove(db, { plan_id: planId });

      await InvasivePlantChecklist.create(db, snapshot.invasivePlantChecklist);
    }

    if (!preserverHistory) {
      await PlanStatusHistory.remove(db, { plan_id: planId });
      const newStatusHistoryPromises = snapshot.planStatusHistory.map(async ({ ...history }) => {
        const newHistory = await PlanStatusHistory.create(db, {
          ...history,
        });
        return newHistory;
      });
      await Promise.all(newStatusHistoryPromises);
    }
    await PlanFile.remove(db, { plan_id: planId });

    const filePromises = snapshot.files.map(async (file) => {
      const newFile = await PlanFile.create(db, file);

      return newFile;
    });

    await Promise.all(filePromises);
  }

  static isLegal(plan) {
    return Plan.legalStatuses.includes(plan.statusId);
  }

  static isAmendment(plan) {
    return plan.amendmentTypeId !== null;
  }

  async eagerloadAllOneToMany() {
    const agreement = await Plan.agreementForPlanId(this.db, this.id);
    await this.fetchPastures();
    await this.fetchSchedules(agreement.agreement_type_id);
    await this.fetchMinisterIssues();
    await this.fetchPlanStatusHistory();
    await this.fetchPlanConfirmations();
    await this.fetchInvasivePlantChecklist();
    await this.fetchAdditionalRequirements();
    await this.fetchManagementConsiderations();
    await this.fetchFiles();
    await this.fetchExtensionRequests();
  }

  async fetchPlanConfirmations() {
    const confirmations = await PlanConfirmation.find(this.db, {
      plan_id: this.id,
    });
    for (const confirmation of confirmations) {
      if (confirmation.userId) {
        const user = await User.findOne(this.db, { id: confirmation.userId });
        confirmation.user = user;
      }
    }
    this.confirmations = confirmations || [];
  }

  async fetchExtensionRequests() {
    const where = { plan_id: this.id };
    const planExtensionRequests = await PlanExtensionRequests.findWithExclusion(this.db, where);
    this.planExtensionRequests = planExtensionRequests || [];
  }

  async fetchPastures() {
    const where = { plan_id: this.id };
    const pastures = await Pasture.find(this.db, where, ['created_at']);
    const promises = pastures.map((p) => [p.fetchPlantCommunities(this.db, { pasture_id: p.id })]);
    await Promise.all(flatten(promises));
    this.pastures = pastures || [];
  }

  async fetchSchedules(agreementTypeId) {
    const order = ['year', 'asc'];
    const where = { plan_id: this.id };
    const schedules = await Schedule.find(this.db, where, order);
    let promises = [];
    if (agreementTypeId === 1 || agreementTypeId === 2) {
      promises = schedules.map((s) => s.fetchGrazingSchedulesEntries(this.db));
    } else if (agreementTypeId === 2 || agreementTypeId === 3) {
      promises = schedules.map((s) => s.fetchHayCuttingScheduleEntries(this.db));
    }
    await Promise.all(promises);
    this.schedules = schedules || [];
  }

  async fetchMinisterIssues() {
    const where = { plan_id: this.id };
    const ministerIssues = await MinisterIssue.findWithType(this.db, where);

    // eagar load pasture ids and minister issue actions.
    const promises = ministerIssues.map((i) => [
      i.fetchPastureIds(this.db, { minister_issue_id: i.id }),
      i.fetchMinisterIssueActions(this.db, { issue_id: i.id }),
    ]);

    await Promise.all(flatten(promises));

    this.ministerIssues = ministerIssues || [];
  }

  async fetchPlanStatusHistory() {
    const where = { plan_id: this.id };
    const planStatusHistory = await PlanStatusHistory.findWithUser(this.db, where);

    this.planStatusHistory = planStatusHistory || [];
  }

  async fetchInvasivePlantChecklist() {
    const where = { plan_id: this.id };
    const checklist = await InvasivePlantChecklist.findOne(this.db, where);

    this.invasivePlantChecklist = checklist || {};
  }

  async fetchAdditionalRequirements() {
    const where = { plan_id: this.id };
    const requirements = await AdditionalRequirement.findWithCategory(this.db, where);

    this.additionalRequirements = requirements || [];
  }

  async fetchManagementConsiderations() {
    const where = { plan_id: this.id };
    const considerations = await ManagementConsideration.findWithType(this.db, where);

    this.managementConsiderations = considerations || [];
  }

  async fetchFiles() {
    const where = { plan_id: this.id };
    const planFiles = await PlanFile.find(this.db, where);

    for (const file of planFiles) {
      file.user = await User.findById(this.db, file.userId);
    }

    this.files = planFiles;
  }

  static async fetchExpiringPlans(db, endDateStart, endDateEnd, orderBy) {
    const q = db
      .select([
        'plan.id as planId',
        'plan.status_id',
        'plan.amendment_type_id',
        'plan.extension_status',
        'agreement.retired',
        'client_agreement.id as clientAgreementId',
        'client_agreement.agreement_id as agreementId',
        'client_agreement.client_id as clientId',
        'user_account.email as email',
        'user_account.id as userId',
      ])
      .from(Plan.table)
      .leftJoin('agreement', {
        'plan.agreement_id': 'agreement.forest_file_id',
      })
      .leftJoin('client_agreement', {
        'plan.agreement_id': 'client_agreement.agreement_id',
      })
      .leftJoin('user_client_link', {
        'user_client_link.client_id': 'client_agreement.client_id',
      })
      .leftJoin('user_account', {
        'user_account.id': 'user_client_link.user_id',
      })
      .where(function () {
        this.whereNot('agreement.retired', '=', true);
        this.where('plan_end_date', '>=', endDateStart);
        this.andWhere('plan_end_date', '<=', endDateEnd);
        this.where(function () {
          this.whereNull('extension_status').orWhere({
            extension_status: PLAN_EXTENSION_STATUS.ACTIVE_REPLACEMENT_PLAN,
          });
        });
        this.whereIn('status_id', [8, 9, 12, 20, 21, 22]);
      })
      .orWhere(function () {
        this.whereNot('agreement.retired', '=', true);
        this.where('plan_end_date', '>=', endDateStart);
        this.andWhere('plan_end_date', '<=', endDateEnd);
        this.where(function () {
          this.whereNull('extension_status').orWhere({
            extension_status: PLAN_EXTENSION_STATUS.ACTIVE_REPLACEMENT_PLAN,
          });
        });
        this.whereIn('status_id', [11, 13, 18]);
        this.whereNotNull('amendment_type_id');
      })
      .orderBy(orderBy);
    try {
      // console.log(q.toSQL().toNative());
      return await q;
    } catch (e) {
      console.error(e);
    }
  }
}
