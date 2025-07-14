import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields, objPathToSnakeCase } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';

const dm = new DataManager(config);
const { db, Agreement, Plan, Schedule, GrazingScheduleEntry, HayCuttingScheduleEntry } = dm;

export default class PlanScheduleController {
  /**
   * Create a schedule for existing plan
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async store(req, res) {
    const {
      params: { planId },
      body,
      user,
    } = req;
    const { scheduleEntries = [], sortBy, ...rest } = body;

    checkRequiredFields(['planId'], 'params', req);

    const trx = await db.transaction();

    try {
      const agreementId = await Plan.agreementIdForPlanId(trx, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);

      const agreement = await Agreement.findById(trx, agreementId);
      const isGrazing = Agreement.isGrazingSchedule(agreement);
      const isHayCutting = Agreement.isHayCuttingSchedule(agreement);
      // Additional validation for grazing entries
      if (isGrazing) {
        scheduleEntries.forEach((entry) => {
          if (!entry.livestockTypeId) {
            throw errorWithCode('Each grazing schedule entry must have a livestockTypeId');
          }
        });
      }

      delete rest.id;
      const schedule = await Schedule.create(trx, {
        ...rest,
        plan_id: planId,
        sort_by: sortBy && objPathToSnakeCase(sortBy),
      });

      const entryCreates = scheduleEntries.map((entry) => {
        const baseEntry = {
          ...entry,
          pasture_id: entry.pastureId,
        };

        if (isGrazing) {
          return GrazingScheduleEntry.create(trx, {
            ...baseEntry,
            grazing_schedule_id: schedule.id,
            livestock_count: entry.livestockCount?.toString(),
          });
        } else if (isHayCutting) {
          return HayCuttingScheduleEntry.create(trx, {
            ...baseEntry,
            haycutting_schedule_id: schedule.id,
          });
        }
      });

      await Promise.all(entryCreates);

      if (isGrazing) {
        await schedule.fetchGrazingSchedulesEntries(trx);
      } else {
        await schedule.fetchHayCuttingScheduleEntries(trx);
      }

      await trx.commit();

      return res.status(200).json(schedule).end();
    } catch (error) {
      await trx.rollback();
      logger.error(`PlanScheduleController: store: fail with error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update an existing Schedule (and related Grazing Schedule Entries) of an existing Plan
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async update(req, res) {
    const { body, user, params } = req;
    const { planId, scheduleId } = params;
    const { scheduleEntries = [], sortBy, ...rest } = body;

    checkRequiredFields(['planId', 'scheduleId'], 'params', req);

    const trx = await db.transaction();

    try {
      const agreementId = await Plan.agreementIdForPlanId(trx, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);

      const agreement = await Agreement.findById(trx, agreementId);
      const isGrazing = Agreement.isGrazingSchedule(agreement);
      const isHayCutting = Agreement.isHayCuttingSchedule(agreement);

      // Extra validation for grazing entries
      if (isGrazing) {
        scheduleEntries.forEach((entry) => {
          if (!entry.livestockTypeId) {
            throw errorWithCode('Each grazing schedule entry must have a livestockTypeId');
          }
        });
      }
      const schedule = await Schedule.update(
        trx,
        { id: scheduleId },
        {
          ...rest,
          plan_id: planId,
          sort_by: sortBy && objPathToSnakeCase(sortBy),
        },
      );
      const ops = scheduleEntries.map((entry) => {
        const baseData = {
          ...entry,
          pasture_id: entry.pastureId,
        };

        if (isGrazing) {
          const data = {
            ...baseData,
            grazing_schedule_id: schedule.id,
            livestock_count: entry.livestockCount?.toString(),
          };

          return entry.id
            ? GrazingScheduleEntry.update(trx, { id: entry.id }, data)
            : GrazingScheduleEntry.create(trx, data);
        } else if (isHayCutting) {
          const data = {
            ...baseData,
            haycutting_schedule_id: schedule.id,
          };
          return entry.id
            ? HayCuttingScheduleEntry.update(trx, { id: entry.id }, data)
            : HayCuttingScheduleEntry.create(trx, data);
        } else {
          throw errorWithCode(`Unsupported schedule entry type for agreement type ${agreement.agreementTypeId}`, 400);
        }
      });

      await Promise.all(ops);

      if (isGrazing) {
        await schedule.fetchGrazingSchedulesEntries(trx);
      } else if (isHayCutting) {
        await schedule.fetchHayCuttingScheduleEntries(trx);
      }

      await trx.commit();

      return res.status(200).json(schedule).end();
    } catch (error) {
      await trx.rollback();
      logger.error(`PlanScheduleController: update: fail with error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a Schedule (and related Grazing Schedule Entries) from an existing Plan
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async destroy(req, res) {
    const { user, params } = req;
    const { planId, scheduleId } = params;

    checkRequiredFields(['planId', 'scheduleId'], 'params', req);

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      // WARNING: This will do a cascading delete on any grazing schedule
      // entries. It will not modify other relations.
      const result = await Schedule.removeById(db, scheduleId);
      if (result === 0) {
        throw errorWithCode('No such schedule exists', 400);
      }

      return res.status(204).end();
    } catch (error) {
      const message = `PlanScheduleController: destroy: fail for id => ${scheduleId}`;
      logger.error(`${message}, with error = ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a grazing schedule entry to an existing grazing schedule
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async storeScheduleEntry(req, res) {
    const { body, params, user } = req;
    const { planId, scheduleId } = params;

    checkRequiredFields(['planId', 'scheduleId'], 'params', req);

    const trx = await db.transaction();

    try {
      const agreementId = await Plan.agreementIdForPlanId(trx, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);

      // Remove plan-related IDs from body to avoid conflict
      delete body.planId;
      delete body.plan_id;

      const schedule = await Schedule.findById(trx, scheduleId);
      if (!schedule) {
        throw errorWithCode('No such schedule exists', 400);
      }

      const agreement = await Agreement.findById(trx, agreementId);
      if (!agreement) {
        throw errorWithCode('No such agreement exists', 400);
      }

      const agreementTypeId = agreement.agreementTypeId;
      const creator = Schedule.scheduleEntryCreators?.[agreementTypeId];

      if (!creator) {
        throw errorWithCode(`Unsupported schedule entry type for agreement type ${agreementTypeId}`, 400);
      }

      const entry = await creator(trx, {
        ...body,
        [`${creator === GrazingScheduleEntry.create ? 'grazing' : 'haycutting'}_schedule_id`]: schedule.id,
      });

      await trx.commit();
      return res.status(200).json(entry).end();
    } catch (error) {
      await trx.rollback();
      logger.error(`PlanScheduleController: storeScheduleEntry: fail with error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a Grazing Schedule Entries from Grazing Schedule
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async destroyScheduleEntry(req, res) {
    const { params, user } = req;
    const { planId, grazingScheduleEntryId } = params;

    checkRequiredFields(['planId', 'grazingScheduleEntryId'], 'params', req);

    const trx = await db.transaction();

    try {
      const agreementId = await Plan.agreementIdForPlanId(trx, planId);
      const agreement = await Agreement.find(trx, { id: agreementId });

      if (!agreement) {
        throw errorWithCode(`Agreement not found for plan ID ${planId}`, 400);
      }

      await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);

      const agreementTypeId = agreement.agreementTypeId;

      const entryRemovers = {
        1: GrazingScheduleEntry.removeById,
        2: GrazingScheduleEntry.removeById,
        3: HayCuttingScheduleEntry.removeById,
        4: HayCuttingScheduleEntry.removeById,
      };

      const remover = entryRemovers[agreementTypeId];
      if (!remover) {
        throw errorWithCode(`Unsupported agreement type: ${agreementTypeId}`, 400);
      }

      const result = await remover(trx, grazingScheduleEntryId);

      if (result === 0) {
        throw errorWithCode('No such schedule entry exists', 400);
      }

      await trx.commit();
      return res.status(204).end();
    } catch (error) {
      await trx.rollback();
      logger.error(
        `PlanScheduleController: destroyScheduleEntry: fail for id => ${params.grazingScheduleEntryId}, with error = ${error.message}`,
      );
      throw error;
    }
  }

  static async updateSortOrder(req, res) {
    const { params, user, body } = req;
    const { planId, scheduleId } = params;
    const { sortOrder } = body;
    let { sortBy } = body;

    checkRequiredFields(['planId', 'scheduleId'], 'params', req);

    const trx = await db.transaction();

    try {
      const agreementId = await Plan.agreementIdForPlanId(trx, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);

      if (sortBy) {
        sortBy = objPathToSnakeCase(sortBy.replace('livestockType', 'ref_livestock')).replace('.', '_');
      }

      const updated = await trx('grazing_schedule')
        .where({ id: scheduleId })
        .update({
          sort_by: sortBy || null,
          sort_order: sortOrder || null,
        });

      if (updated === 0) {
        throw errorWithCode('No such grazing schedule entry exists', 400);
      }

      await trx.commit();
      return res.status(204).end();
    } catch (error) {
      await trx.rollback();
      const message = `PlanScheduleController:updateSortOrder failed for schedule ID: ${scheduleId}`;
      logger.error(`${message}, error: ${error.message}`);
      throw error;
    }
  }
}
