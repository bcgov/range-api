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
import GrazingSchedule from './grazingschedule';
import Model from './model';
import Pasture from './pasture';
import PlanExtension from './planextension';
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
import MinisterIssueAction from './ministerissueaction';
import MinisterIssuePasture from './ministerissuepasture';
import PlanSnapshot from './plansnapshot';
import Agreement from './agreement';

export default class Plan extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (Plan.fields.indexOf(`${Plan.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.status = new PlanStatus(PlanStatus.extract(data));
    // The left join will return `null` values when no related record exists
    // so we manually exclude them.
    const extension = new PlanExtension(PlanExtension.extract(data));
    this.extension = extension.id === null ? null : extension;
    this.creator = new User(User.extract(data));
  }

  static get fields() {
    // TODO:(jl) Work with consumers to remove 'agreement_id' from the selected
    // fields.

    // primary key *must* be first!
    return [
      'id', 'range_name', 'plan_start_date', 'plan_end_date',
      'notes', 'alt_business_name', 'agreement_id', 'status_id',
      'uploaded', 'amendment_type_id', 'created_at', 'updated_at',
      'effective_at', 'submitted_at', 'creator_id', 'canonical_id',
    ].map(f => `${Plan.table}.${f}`);
  }

  static get table() {
    return 'plan';
  }

  static async findCurrentVersion(db, canonicalId) {
    try {
      const { rows: [currentVersion] } = await db.raw(`
        SELECT plan.*
        FROM plan_version
        INNER JOIN plan ON plan_version.plan_id = plan.id
        WHERE plan_version.canonical_id = ? AND version = -1;
        `, [canonicalId]);
      return currentVersion;
    } catch (e) {
      return null;
    }
  }

  static async findWithStatusExtension(
    db, where, order,
    page = undefined, limit = undefined, whereNot = undefined,
  ) {
    const myFields = [
      ...Plan.fields,
      ...PlanStatus.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
      ...PlanExtension.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
      ...User.fields.map(f => `${f} AS ${f.replace('.', '_')}`),
    ];

    try {
      let results = [];
      const q = db
        .select(myFields)
        .from(Plan.table)
        .join('ref_plan_status', { 'plan.status_id': 'ref_plan_status.id' })
        // left join otherwise if extension is NULL we don't get any results
        .leftJoin('extension', { 'plan.extension_id': 'extension.id' })
        .join('user_account', { 'plan.creator_id': 'user_account.id' })
        .where({ ...where, uploaded: true })
        .orderBy(...order);

      if (whereNot) {
        results = q.andWhere(...whereNot);
      }

      if (page && limit) {
        const offset = limit * (page - 1);
        results = await q
          .offset(offset)
          .limit(limit);
      } else {
        results = await q;
      }

      return results.map(row => new Plan(row, db));
    } catch (err) {
      throw err;
    }
  }

  // Fetch the Agreement ID associated with a given Plan
  static async agreementForPlanId(db, planId) {
    if (!db || !planId) {
      return [];
    }

    const results = await db
      .select('agreement_id')
      .from(Plan.table)
      .where({ id: planId });

    if (results.length === 0) return null;

    const [result] = results;
    return result.agreement_id;
  }

  static async createSnapshot(db, planId) {
    const [plan] = await Plan.findWithStatusExtension(db, { 'plan.id': planId }, ['id', 'desc']);
    if (!plan) {
      throw errorWithCode('Plan doesn\'t exist', 404);
    }
    const { agreementId } = plan;

    const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(
      db, { forest_file_id: agreementId },
    );
    await agreement.eagerloadAllOneToManyExceptPlan();
    agreement.transformToV1();

    await plan.eagerloadAllOneToMany();
    plan.agreement = agreement;

    await plan.eagerloadAllOneToMany();

    const snapshot = JSON.stringify(plan);

    const { rows: [{ max: lastVersion }] } = await db.raw(`
      SELECT MAX(version) FROM plan_snapshot
      WHERE plan_id = ?
    `, [plan.id]);

    const snapshotRecord = await PlanSnapshot.create(db, {
      snapshot,
      plan_id: planId,
      created_at: new Date(),
      version: lastVersion + 1,
      status_id: plan.statusId,
    });

    return snapshotRecord;
  }

  static async duplicateAll(db, planId) {
    const planRow = await Plan.findById(db, planId);
    const plan = new Plan(planRow, db);

    await plan.eagerloadAllOneToMany();

    const { id: oldPlanId, ...planData } = planRow;
    const newPlan = await Plan.create(db, {
      ...planData,
    });

    try {
      db.raw('BEGIN');

      const pasturePromises = plan.pastures.map(
        async ({ id: pastureId, ...pasture }) => {
          const newPasture = await Pasture.create(db, {
            ...pasture,
            plan_id: newPlan.id,
          });

          const plantCommunityPromises = pasture.plantCommunities.map(
            async ({ id: plantCommunityId, ...plantCommunity }) => {
              const newPlantCommunity = await PlantCommunity.create(db, {
                ...plantCommunity,
                pasture_id: newPasture.id,
              });

              const indicatorPlantPromises = plantCommunity.indicatorPlants.map(
                async ({ id: indicatorPlantId, ...indicatorPlant }) => {
                  const newIndicatorPlant = await IndicatorPlant.create(db, {
                    ...indicatorPlant,
                    plant_community_id: newPlantCommunity.id,
                  });

                  return newIndicatorPlant;
                },
              );

              const newIndicatorPlants = await Promise.all(indicatorPlantPromises);

              const monitoringAreaPromises = plantCommunity.monitoringAreas.map(
                async ({ id: monitoringAreaId, ...monitoringArea }) => {
                  const newMonitoringArea = await MonitoringArea.create(db, {
                    ...monitoringArea,
                    plant_community_id: newPlantCommunity.id,
                  });

                  const purposePromises = monitoringArea.purposes.map(
                    async ({ id: purposeId, ...purpose }) => {
                      const newPurpose = await MonitoringAreaPurpose.create(db, {
                        ...purpose,
                        monitoring_area_id: newMonitoringArea.id,
                      });

                      return newPurpose;
                    },
                  );

                  const newPurposes = await Promise.all(purposePromises);

                  return {
                    ...newMonitoringArea,
                    monitoringAreaPurposes: newPurposes,
                  };
                },
              );

              const newMonitoringAreas = await Promise.all(monitoringAreaPromises);

              const actionPromises = plantCommunity.plantCommunityActions.map(
                async ({ id: actionId, ...action }) => {
                  const newAction = await PlantCommunityAction.create(db, {
                    ...action,
                    plant_community_id: newPlantCommunity.id,
                  });

                  return newAction;
                },
              );

              const newActions = await Promise.all(actionPromises);

              return {
                ...newPlantCommunity,
                indicatorPlants: newIndicatorPlants,
                monitoringAreas: newMonitoringAreas,
                plantCommunityActions: newActions,
              };
            },
          );

          const newPlantCommunities = await Promise.all(plantCommunityPromises);


          return {
            ...newPasture,
            plantCommunities: newPlantCommunities,
            original: { id: pastureId, ...pasture },
          };
        },
      );

      const newPastures = await Promise.all(pasturePromises);

      const schedulePromises = plan.grazingSchedules.map(
        async ({ id: scheduleId, ...schedule }) => {
          const newSchedule = await GrazingSchedule.create(db, {
            ...schedule,
            plan_id: newPlan.id,
          });

          const entryPromises = schedule.grazingScheduleEntries.map(
            async ({ id: entryId, ...entry }) => {
              const pasture = newPastures.find(p => p.original.id === entry.pastureId);
              const newEntry = await GrazingScheduleEntry.create(db, {
                ...entry,
                grazing_schedule_id: newSchedule.id,
                pasture_id: pasture.id,
              });

              return newEntry;
            },
          );

          const newEntries = await Promise.all(entryPromises);

          return {
            ...newSchedule,
            grazingScheduleEntries: newEntries,
          };
        },
      );

      const newGrazingSchedules = await Promise.all(schedulePromises);

      const additionalRequirementPromises = plan.additionalRequirements.map(
        async ({ id: requirementId, ...requirement }) => {
          const newRequirement = await AdditionalRequirement.create(db, {
            ...requirement,
            plan_id: newPlan.id,
          });

          return newRequirement;
        },
      );

      const newAdditionalRequirements = await Promise.all(additionalRequirementPromises);

      const ministerIssuePromises = plan.ministerIssues.map(
        async ({ id: issueId, ...issue }) => {
          const newIssue = await MinisterIssue.create(db, {
            ...issue,
            plan_id: newPlan.id,
          });

          const actionPromises = issue.ministerIssueActions.map(
            async ({ id: actionId, ...action }) => {
              const newAction = await MinisterIssueAction.create(db, {
                ...action,
                issue_id: newIssue.id,
              });


              return newAction;
            },
          );

          const newActions = await Promise.all(actionPromises);

          const ministerPasturePromises = issue.pastures.map(
            async (pastureId) => {
              const pasture = newPastures.find(p => p.original.id === pastureId);
              const newPasture = await MinisterIssuePasture.create(db, {
                pasture_id: pasture.id,
                minister_issue_id: newIssue.id,
              });

              return newPasture;
            },
          );

          const newMinisterPastures = await Promise.all(ministerPasturePromises);

          return {
            ...newIssue,
            ministerIssueActions: newActions,
            ministerIssuePastures: newMinisterPastures,
          };
        },
      );

      const newMinisterIssues = await Promise.all(ministerIssuePromises);

      const managementConsiderationPromises = plan.managementConsiderations.map(
        async ({ id: considerationId, ...consideration }) => {
          const newConsideration = await ManagementConsideration.create(db, {
            ...consideration,
            plan_id: newPlan.id,
          });

          return newConsideration;
        },
      );

      const newConsiderations = await Promise.all(managementConsiderationPromises);

      const confirmationPromises = plan.confirmations.map(
        async ({ id: confirmationId, ...confirmation }) => {
          const newConfirmation = await PlanConfirmation.create(db, {
            ...confirmation,
            plan_id: newPlan.id,
          });

          return newConfirmation;
        },
      );

      const newConfirmations = await Promise.all(confirmationPromises);

      const { id, ...invasivePlantChecklist } = plan.invasivePlantChecklist;

      const newInvasivePlantChecklist = await InvasivePlantChecklist.create(db, {
        ...invasivePlantChecklist,
        plan_id: newPlan.id,
      });

      const newStatusHistoryPromises = plan.planStatusHistory.map(
        async ({ id: historyId, ...history }) => {
          const newHistory = await PlanStatusHistory.create(db, {
            ...history,
            plan_id: newPlan.id,
          });

          return newHistory;
        },
      );

      await Promise.all(newStatusHistoryPromises);

      db.raw('COMMIT');

      return {
        ...newPlan,
        pastures: newPastures,
        additionalRequirements: newAdditionalRequirements,
        ministerIssues: newMinisterIssues,
        managementConsiderations: newConsiderations,
        grazingSchedules: newGrazingSchedules,
        invasivePlantChecklist: newInvasivePlantChecklist,
        confirmations: newConfirmations,
      };
    } catch (e) {
      db.raw('ROLLBACK');
      throw e;
    }
  }

  async eagerloadAllOneToMany() {
    await this.fetchPastures();
    await this.fetchGrazingSchedules();
    await this.fetchMinisterIssues();
    await this.fetchPlanStatusHistory();
    await this.fetchPlanConfirmations();
    await this.fetchInvasivePlantChecklist();
    await this.fetchAdditionalRequirements();
    await this.fetchManagementConsiderations();
  }

  async fetchPlanConfirmations() {
    const confirmations = await PlanConfirmation.find(
      this.db, { plan_id: this.id },
    );
    this.confirmations = confirmations || [];
  }

  async fetchPastures() {
    const where = { plan_id: this.id };
    const pastures = await Pasture.find(this.db, where, ['created_at']);

    const promises = pastures.map(p =>
      [
        p.fetchPlantCommunities(this.db, { pasture_id: p.id }),
      ]);

    await Promise.all(flatten(promises));

    this.pastures = pastures || [];
  }

  async fetchGrazingSchedules() {
    const order = ['year', 'asc'];
    const where = { plan_id: this.id };
    const schedules = await GrazingSchedule.find(this.db, where, order);
    // egar load grazing schedule entries.
    const promises = schedules.map(s => s.fetchGrazingSchedulesEntries(
      this.db,
      {
        grazing_schedule_id: s.id,
      },
    ));
    await Promise.all(promises);

    this.grazingSchedules = schedules || [];
  }

  async fetchMinisterIssues() {
    const where = { plan_id: this.id };
    const ministerIssues = await MinisterIssue.findWithType(this.db, where);

    // eagar load pasture ids and minister issue actions.
    const promises = ministerIssues.map(i =>
      [
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
}
