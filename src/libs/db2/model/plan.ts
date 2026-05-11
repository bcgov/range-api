import { sql } from 'kysely';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import { errorWithCode } from '../../../libs/bcgov-shim.js';
import { PLAN_EXTENSION_STATUS } from '../../../constants.js';
import Schedule from './grazingschedule.js';
import Pasture from './pasture.js';
import PlanStatus from './planstatus.js';
import MinisterIssue from './ministerissue.js';
import PlanStatusHistory from './planstatushistory.js';
import PlanConfirmation from './planconfirmation.js';
import User from './user.js';
import InvasivePlantChecklist from './invasiveplantchecklist.js';
import AdditionalRequirement from './additionalrequirement.js';
import ManagementConsideration from './managementconsideration.js';
import PlantCommunity from './plantcommunity.js';
import IndicatorPlant from './indicatorplant.js';
import MonitoringArea from './monitoringarea.js';
import MonitoringAreaPurpose from './monitoringareapurpose.js';
import PlantCommunityAction from './plantcommunityaction.js';
import GrazingScheduleEntry from './grazingscheduleentry.js';
import HayCuttingScheduleEntry from './haycuttingscheduleentry.js';
import MinisterIssueAction from './ministerissueaction.js';
import MinisterIssuePasture from './ministerissuepasture.js';
import PlanSnapshot from './plansnapshot.js';
import Agreement from './agreement.js';
import PlanFile from './PlanFile.js';
import PlanExtensionRequests from './planextensionrequests.js';

export default class Plan extends KyselyModel {
  declare id: number;
  declare rangeName: string;
  declare planStartDate: Date;
  declare planEndDate: Date;
  declare notes: string;
  declare altBusinessName: string;
  declare agreementId: string;
  declare statusId: number;
  declare uploaded: boolean;
  declare amendmentTypeId: number;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare effectiveAt: Date;
  declare submittedAt: Date;
  declare creatorId: number;
  declare canonicalId: number;
  declare isRestored: boolean;
  declare conditions: string;
  declare proposedConditions: string;
  declare livestockDistributionDetail: string;
  declare extensionStatus: number;
  declare extensionRequiredVotes: number;
  declare extensionReceivedVotes: number;
  declare replacementOf: number;
  declare extensionDate: Date;
  declare extensionRejectedBy: number;
  declare replacementPlanId: number;
  declare db: any;
  declare status: any;
  declare creator: any;
  declare requestedExtension: any;
  declare requestedExtensionUserId: any;
  declare planExtensionRequests: any;
  pastures: any[] = [];
  schedules: any[] = [];
  ministerIssues: any[] = [];
  planStatusHistory: any[] = [];
  confirmations: any[] = [];
  invasivePlantChecklist: any = {};
  additionalRequirements: any[] = [];
  managementConsiderations: any[] = [];
  files: any[] = [];
  declare agreement: any;

  constructor(data: Record<string, any>, _db?: any) {
    const obj: Record<string, any> = {};
    Object.keys(data).forEach((key) => {
      if (Plan.fields.indexOf(key) > -1 || Plan.fields.indexOf(`plan.${key}`) > -1) {
        obj[key] = data[key];
      }
    });
    super(obj, _db);
    this.db = _db;

    this.status = new PlanStatus(PlanStatus.extract(data));
    this.requestedExtension = data.extension_requests_requested_extension;
    this.requestedExtensionUserId = data.extension_requests_user_id;
    this.creator = new User(User.extract(data));
    this.planExtensionRequests = new PlanExtensionRequests(PlanExtensionRequests.extract(data));
  }

  static legalStatuses: number[] = [20, 8, 9, 12, 21];

  static get fields(): string[] {
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
      'livestock_distribution_detail',
      'extension_status',
      'extension_required_votes',
      'extension_received_votes',
      'replacement_of',
      'extension_date',
      'extension_rejected_by',
      'replacement_plan_id',
    ];
  }

  static get table(): string {
    return 'plan';
  }

  static async find(_db: any, where: Record<string, any>, order?: [string, string]) {
    const hasEmptyIn = Object.values(where).some((v) => Array.isArray(v) && v.length === 0);
    if (hasEmptyIn) return [];

    const db = _db || kyselyDb;
    let query: any = db
      .selectFrom('plan')
      .leftJoin('ref_plan_status', 'plan.status_id', 'ref_plan_status.id')
      .selectAll('plan')
      .select([
        'ref_plan_status.id as ref_plan_status_id',
        'ref_plan_status.code as ref_plan_status_code',
        'ref_plan_status.name as ref_plan_status_name',
      ]);
    Object.entries(where).forEach(([k, v]) => {
      const col = k.includes('.') ? k : `plan.${k}`;
      if (Array.isArray(v) && v.length > 0) query = query.where(col, 'in', v);
      else query = query.where(col, '=', v);
    });
    if (order && order.length > 0) query = query.orderBy(order[0], order[1] || 'asc');
    const results = await query.execute();
    return results.map((row: any) => new Plan(row, _db));
  }

  static extract(data: Record<string, any>): Record<string, any> {
    const obj: Record<string, any> = {};
    Object.keys(data).forEach((key) => {
      const prefix = 'plan';
      if (key.startsWith(prefix) && !key.startsWith('plan_')) {
        const aKey = key.replace(prefix, '').slice(1);
        obj[aKey] = data[key];
      }
    });
    return obj;
  }

  static async findCurrentVersion(_db: any, canonicalId: number) {
    const db = _db || kyselyDb;
    try {
      const results: any = await db
        .selectFrom('plan_version')
        .innerJoin('plan', 'plan_version.plan_id', 'plan.id')
        .selectAll('plan')
        .where('plan_version.canonical_id', '=', canonicalId)
        .where('plan_version.version', '=', -1)
        .execute();
      return results[0] || null;
    } catch {
      return null;
    }
  }

  static async findWithStatusExtension(
    _db: any,
    where: Record<string, any>,
    order: [string, string],
    page?: number,
    limit?: number,
    whereNot?: [string, any],
  ) {
    const db = _db || kyselyDb;
    const selectFields: any[] = [
      'plan.id',
      'plan.range_name',
      'plan.plan_start_date',
      'plan.plan_end_date',
      'plan.notes',
      'plan.alt_business_name',
      'plan.agreement_id',
      'plan.status_id',
      'plan.uploaded',
      'plan.amendment_type_id',
      'plan.created_at',
      'plan.updated_at',
      'plan.effective_at',
      'plan.submitted_at',
      'plan.creator_id',
      'plan.canonical_id',
      'plan.is_restored',
      'plan.conditions',
      'plan.proposed_conditions',
      'plan.livestock_distribution_detail',
      'plan.extension_status',
      'plan.extension_required_votes',
      'plan.extension_received_votes',
      'plan.replacement_of',
      'plan.extension_date',
      'plan.extension_rejected_by',
      'plan.replacement_plan_id',
      sql`ref_plan_status.id`.as('ref_plan_status_id'),
      sql`ref_plan_status.code`.as('ref_plan_status_code'),
      sql`ref_plan_status.name`.as('ref_plan_status_name'),
      sql`ref_plan_status.active`.as('ref_plan_status_active'),
      sql`user_account.id`.as('user_account_id'),
      sql`user_account.username`.as('user_account_username'),
      sql`user_account.given_name`.as('user_account_given_name'),
      sql`user_account.family_name`.as('user_account_family_name'),
      sql`user_account.email`.as('user_account_email'),
      sql`user_account.phone_number`.as('user_account_phone_number'),
      sql`user_account.active`.as('user_account_active'),
      sql`user_account.role_id`.as('user_account_role_id'),
    ];
    let query: any = db
      .selectFrom('plan')
      .innerJoin('ref_plan_status', 'plan.status_id', 'ref_plan_status.id')
      .innerJoin('user_account', 'plan.creator_id', 'user_account.id')
      .select(selectFields);
    Object.entries(where).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0) query = query.where(k, 'in', v);
      } else {
        query = query.where(k, '=', v);
      }
    });
    query = query.where('plan.uploaded', '=', true);
    query = query.orderBy(order[0], order[1] || 'asc');
    if (whereNot) {
      query = query.where(whereNot[0], '!=', whereNot[1]);
    }
    if (page && limit) {
      const offset = limit * (page - 1);
      query = query.offset(offset).limit(limit);
    }
    const results = await query.execute();
    return results.map((row: any) => new Plan(row, _db));
  }

  static async agreementIdForPlanId(_db: any, planId: number) {
    if (!_db || !planId) return [];
    const db = _db || kyselyDb;
    const results: any = await db.selectFrom('plan').select('agreement_id').where('id', '=', planId).execute();
    if (results.length === 0) return null;
    return results[0].agreement_id;
  }

  static async agreementForPlanId(_db: any, planId: number) {
    if (!_db || !planId) return [];
    const db = _db || kyselyDb;
    const results: any = await db
      .selectFrom('plan')
      .innerJoin('agreement', 'plan.agreement_id', 'agreement.forest_file_id')
      .selectAll()
      .where('plan.id', '=', planId)
      .execute();
    if (results.length === 0) return null;
    return results[0];
  }

  static async createSnapshot(_db: any, planId: number, user: any) {
    const db = _db || kyselyDb;
    const [plan] = await Plan.findWithStatusExtension(db, { 'plan.id': planId }, ['plan.id', 'desc']);
    if (!plan) {
      throw errorWithCode("Plan doesn't exist: " + planId, 404);
    }
    const { agreementId } = plan;
    const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(db, { forest_file_id: agreementId });
    await agreement.eagerloadAllOneToManyExceptPlan();
    agreement.transformToV1();
    await plan.eagerloadAllOneToMany();
    plan.agreement = agreement;
    const lastVersionResult: any = await db
      .selectFrom('plan_snapshot')
      .select(db.fn.max('version').as('max'))
      .where('plan_id', '=', plan.id)
      .execute();
    const lastVersion = lastVersionResult[0]?.max || 0;
    const snapshotRecord = await (PlanSnapshot.create as any)(
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

  static async restoreVersion(_db: any, planId: number, snapshotVersion: number, preserverHistory = false) {
    const db = _db || kyselyDb;
    const planSnapshot = await PlanSnapshot.findOne(db, { plan_id: planId, version: snapshotVersion });
    if (!planSnapshot) {
      throw errorWithCode(`Snapshot for plan ${planId}, version: ${snapshotVersion} does not exist.`, 404);
    }
    const { snapshot } = planSnapshot;
    await Plan.update(db, { id: planId }, { ...snapshot, isRestored: true });
    await Pasture.remove(db, { plan_id: planId });
    const pasturePromises = snapshot.pastures.map(async (pasture: any) => {
      const newPasture = await Pasture.create(db, pasture);
      await PlantCommunity.remove(db, { pasture_id: pasture.id });
      const plantCommunityPromises = pasture.plantCommunities.map(async (plantCommunity: any) => {
        const newPlantCommunity = await PlantCommunity.create(db, plantCommunity);
        await IndicatorPlant.remove(db, { plant_community_id: plantCommunity.id });
        const indicatorPlantPromises = plantCommunity.indicatorPlants.map(async (indicatorPlant: any) => {
          return IndicatorPlant.create(db, indicatorPlant);
        });
        const newIndicatorPlants = await Promise.all(indicatorPlantPromises);
        await MonitoringArea.remove(db, { plant_community_id: plantCommunity.id });
        const monitoringAreaPromises = plantCommunity.monitoringAreas.map(async (monitoringArea: any) => {
          const newMonitoringArea = await MonitoringArea.create(db, monitoringArea);
          await MonitoringAreaPurpose.remove(db, { monitoring_area_id: monitoringArea.id });
          const purposePromises = monitoringArea.purposes.map(async (purpose: any) => {
            return MonitoringAreaPurpose.create(db, purpose);
          });
          const newPurposes = await Promise.all(purposePromises);
          return { ...newMonitoringArea, monitoringAreaPurposes: newPurposes };
        });
        const newMonitoringAreas = await Promise.all(monitoringAreaPromises);
        await PlantCommunityAction.remove(db, { plant_community_id: plantCommunity.id });
        const actionPromises = plantCommunity.plantCommunityActions.map(async ({ ...action }: any) => {
          return PlantCommunityAction.create(db, action);
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
      return { ...newPasture, plantCommunities: newPlantCommunities, original: pasture };
    });
    const newPastures: any[] = await Promise.all(pasturePromises);
    await Schedule.remove(db, { plan_id: planId });
    await Promise.all(
      snapshot.schedules.map(async (schedule: any) => {
        const newSchedule = await Schedule.create(db, schedule);
        await Promise.all([
          GrazingScheduleEntry.remove(db, { grazing_schedule_id: schedule.id }),
          HayCuttingScheduleEntry.remove(db, { haycutting_schedule_id: schedule.id }),
        ]);
        const scheduleEntryCreator = Schedule.scheduleEntryCreators[snapshot.agreement.agreementTypeId];
        await Promise.all(
          (schedule.scheduleEntries || [])
            .map((entry: any) => {
              if (!scheduleEntryCreator) return null;
              const entryWithScheduleId =
                scheduleEntryCreator === GrazingScheduleEntry
                  ? { ...entry, grazing_schedule_id: newSchedule.id }
                  : { ...entry, haycutting_schedule_id: newSchedule.id };
              return scheduleEntryCreator.create(db, entryWithScheduleId);
            })
            .filter(Boolean),
        );
        return { ...newSchedule, scheduleEntries: schedule.scheduleEntries };
      }),
    );
    await AdditionalRequirement.remove(db, { plan_id: planId });
    const additionalRequirementPromises = snapshot.additionalRequirements.map(async (requirement: any) => {
      return AdditionalRequirement.create(db, requirement);
    });
    await Promise.all(additionalRequirementPromises);
    await MinisterIssue.remove(db, { plan_id: planId });
    const ministerIssuePromises = snapshot.ministerIssues.map(async (issue: any) => {
      const newIssue = await MinisterIssue.create(db, issue);
      await MinisterIssueAction.remove(db, { issue_id: issue.id });
      const actionPromises = issue.ministerIssueActions.map(async (action: any) => {
        return MinisterIssueAction.create(db, action);
      });
      const newActions = await Promise.all(actionPromises);
      await MinisterIssuePasture.remove(db, { minister_issue_id: issue.id });
      const ministerPasturePromises = issue.pastures.map(async (pastureId: any) => {
        const pasture: any = newPastures.find((p: any) => p.original.id === pastureId);
        return MinisterIssuePasture.create(db, { pasture_id: pasture.id, minister_issue_id: newIssue.id });
      });
      const newMinisterPastures = await Promise.all(ministerPasturePromises);
      return { ...newIssue, ministerIssueActions: newActions, ministerIssuePastures: newMinisterPastures };
    });
    await Promise.all(ministerIssuePromises);
    await ManagementConsideration.remove(db, { plan_id: planId });
    const managementConsiderationPromises = snapshot.managementConsiderations.map(async (consideration: any) => {
      return ManagementConsideration.create(db, consideration);
    });
    await Promise.all(managementConsiderationPromises);
    await PlanConfirmation.remove(db, { plan_id: planId });
    const confirmationPromises = snapshot.confirmations.map(async (confirmation: any) => {
      return PlanConfirmation.create(db, confirmation);
    });
    await Promise.all(confirmationPromises);
    if (snapshot.invasivePlantChecklist && snapshot.invasivePlantChecklist.planId) {
      await InvasivePlantChecklist.remove(db, { plan_id: planId });
      await InvasivePlantChecklist.create(db, snapshot.invasivePlantChecklist);
    }
    if (!preserverHistory) {
      await PlanStatusHistory.remove(db, { plan_id: planId });
      const newStatusHistoryPromises = snapshot.planStatusHistory.map(async ({ ...history }: any) => {
        return PlanStatusHistory.create(db, history);
      });
      await Promise.all(newStatusHistoryPromises);
    }
    await PlanFile.remove(db, { plan_id: planId });
    const filePromises = snapshot.files.map(async (file: any) => {
      return PlanFile.create(db, file);
    });
    await Promise.all(filePromises);
  }

  static isLegal(plan: any) {
    return Plan.legalStatuses.includes(plan.statusId);
  }

  static isAmendment(plan: any) {
    return plan.amendmentTypeId !== null;
  }

  async eagerloadAllOneToMany() {
    const agreement: any = await Plan.agreementForPlanId(this.db, this.id);
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
    const db = this.db || kyselyDb;
    const confirmations = await PlanConfirmation.find(db, { plan_id: this.id });
    for (const confirmation of confirmations) {
      if (confirmation.userId) {
        const user = await User.findOne(db, { id: confirmation.userId });
        confirmation.user = user;
      }
    }
    this.confirmations = confirmations || [];
  }

  async fetchExtensionRequests() {
    const db = this.db || kyselyDb;
    const where = { plan_id: this.id };
    const planExtensionRequests = await (PlanExtensionRequests.findWithExclusion as any)(db, where);
    this.planExtensionRequests = planExtensionRequests || [];
  }

  async fetchPastures() {
    const db = this.db || kyselyDb;
    const where = { plan_id: this.id };
    const pastures = await Pasture.find(db, where, ['created_at'] as any);
    const promises = pastures.map((p: any) => [p.fetchPlantCommunities(db, { pasture_id: p.id })]);
    await Promise.all(promises.flat());
    this.pastures = pastures || [];
  }

  async fetchSchedules(agreementTypeId: number) {
    const db = this.db || kyselyDb;
    const order = ['year', 'asc'];
    const where = { plan_id: this.id };
    const schedules = await Schedule.find(db, where, order as [string, string]);
    let promises: any[] = [];
    if (agreementTypeId === 1 || agreementTypeId === 2) {
      promises = schedules.map((s: any) => s.fetchGrazingSchedulesEntries(db));
    } else if (agreementTypeId === 3 || agreementTypeId === 4) {
      promises = schedules.map((s: any) => s.fetchHayCuttingScheduleEntries(db));
    }
    await Promise.all(promises);
    this.schedules = schedules || [];
  }

  async fetchMinisterIssues() {
    const db = this.db || kyselyDb;
    const where = { plan_id: this.id };
    const ministerIssues = await MinisterIssue.findWithType(db, where);
    const promises = ministerIssues.map((i: any) => [
      i.fetchPastureIds(db, { minister_issue_id: i.id }),
      i.fetchMinisterIssueActions(db, { issue_id: i.id }),
    ]);
    await Promise.all(promises.flat());
    this.ministerIssues = ministerIssues || [];
  }

  async fetchPlanStatusHistory() {
    const db = this.db || kyselyDb;
    const where = { plan_id: this.id };
    const planStatusHistory = await PlanStatusHistory.findWithUser(db, where);
    this.planStatusHistory = planStatusHistory || [];
  }

  async fetchInvasivePlantChecklist() {
    const db = this.db || kyselyDb;
    const where = { plan_id: this.id };
    const checklist = await InvasivePlantChecklist.findOne(db, where);
    this.invasivePlantChecklist = checklist || {};
  }

  async fetchAdditionalRequirements() {
    const db = this.db || kyselyDb;
    const where = { plan_id: this.id };
    const requirements = await AdditionalRequirement.findWithCategory(db, where);
    this.additionalRequirements = requirements || [];
  }

  async fetchManagementConsiderations() {
    const db = this.db || kyselyDb;
    const where = { plan_id: this.id };
    const considerations = await ManagementConsideration.findWithType(db, where);
    this.managementConsiderations = considerations || [];
  }

  async fetchFiles() {
    const db = this.db || kyselyDb;
    const where = { plan_id: this.id };
    const planFiles = await PlanFile.find(db, where);
    for (const file of planFiles) {
      file.user = await User.findById(db, file.userId);
    }
    this.files = planFiles;
  }

  static async fetchExpiringPlans(_db: any, endDateStart: string, endDateEnd: string, orderBy: string) {
    const db = _db || kyselyDb;
    const statusIds1 = [1, 8, 9, 12, 15, 20, 21, 22, 23];
    const statusIds2 = [11, 13, 18];

    const results: any = await db
      .selectFrom('plan')
      .leftJoin('agreement', 'plan.agreement_id', 'agreement.forest_file_id')
      .leftJoin('client_agreement', 'plan.agreement_id', 'client_agreement.agreement_id')
      .leftJoin('user_client_link', 'user_client_link.client_id', 'client_agreement.client_id')
      .leftJoin('user_account', 'user_account.id', 'user_client_link.user_id')
      .select([
        sql`plan.id`.as('planId'),
        'plan.status_id',
        'plan.amendment_type_id',
        'plan.extension_status',
        'agreement.retired',
        sql`client_agreement.id`.as('clientAgreementId'),
        sql`client_agreement.agreement_id`.as('agreementId'),
        sql`client_agreement.client_id`.as('clientId'),
        'user_account.email',
        sql`user_account.id`.as('userId'),
      ])
      .where((eb: any) =>
        eb.or([
          eb.and([
            eb.or([eb('agreement.retired', '!=', true), eb('agreement.retired', 'is', null)]),
            eb('plan.plan_end_date', '>=', endDateStart),
            eb('plan.plan_end_date', '<=', endDateEnd),
            eb.or([
              eb('extension_status', 'is', null),
              eb('extension_status', '=', PLAN_EXTENSION_STATUS.ACTIVE_REPLACEMENT_PLAN),
            ]),
            eb('plan.status_id', 'in', statusIds1),
          ]),
          eb.and([
            eb.or([eb('agreement.retired', '!=', true), eb('agreement.retired', 'is', null)]),
            eb('plan.plan_end_date', '>=', endDateStart),
            eb('plan.plan_end_date', '<=', endDateEnd),
            eb.or([
              eb('extension_status', 'is', null),
              eb('extension_status', '=', PLAN_EXTENSION_STATUS.ACTIVE_REPLACEMENT_PLAN),
            ]),
            eb('plan.status_id', 'in', statusIds2),
            eb('plan.amendment_type_id', 'is not', null),
          ]),
        ]),
      )
      .orderBy(orderBy)
      .execute();
    return results;
  }
}
