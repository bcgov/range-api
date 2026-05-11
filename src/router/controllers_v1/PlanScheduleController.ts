// @ts-nocheck
import { errorWithCode, logger } from '../../libs/bcgov-shim.js';
import { checkRequiredFields, objPathToSnakeCase } from '../../libs/utils.js';
import DataManager from '../../libs/db2/index.js';
import config from '../../config/index.js';
import { PlanRouteHelper } from '../helpers/index.js';
import { processAgreementUsageStatus } from '../../../scripts/process_no_use.js';

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

    let schedule;
    try {
      await db.transaction().execute(async (trx) => {
        const agreementId = await Plan.agreementIdForPlanId(trx, planId);
        await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);

        const agreement = await Agreement.findWithTypeZoneDistrictExemption(trx, {
          'agreement.forest_file_id': agreementId,
        });
        const agreementData = agreement[0]; // findWithTypeZoneDistrictExemption returns an array
        const isGrazing = Agreement.isGrazingSchedule(agreementData);
        const isHayCutting = Agreement.isHayCuttingSchedule(agreementData);
        // Additional validation for grazing entries
        if (isGrazing) {
          scheduleEntries.forEach((entry) => {
            if (!entry.livestockTypeId) {
              throw errorWithCode('Each grazing schedule entry must have a livestockTypeId');
            }
          });
        }

        delete rest.id;
        schedule = await Schedule.create(trx, {
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

        // Update usage status for this agreement within the transaction
        await processAgreementUsageStatus(trx, agreementId, agreementData.agreementTypeId);
      });

      return res.status(200).json(schedule).end();
    } catch (error) {
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

    let schedule;
    try {
      await db.transaction().execute(async (trx) => {
        const agreementId = await Plan.agreementIdForPlanId(trx, planId);
        await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);

        const agreement = await Agreement.findWithTypeZoneDistrictExemption(trx, {
          'agreement.forest_file_id': agreementId,
        });
        const agreementData = agreement[0]; // findWithTypeZoneDistrictExemption returns an array
        const isGrazing = Agreement.isGrazingSchedule(agreementData);
        const isHayCutting = Agreement.isHayCuttingSchedule(agreementData);

        // Extra validation for grazing entries
        if (isGrazing) {
          scheduleEntries.forEach((entry) => {
            if (!entry.livestockTypeId) {
              throw errorWithCode('Each grazing schedule entry must have a livestockTypeId');
            }
          });
        }
        schedule = await Schedule.update(
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
            throw errorWithCode(
              `Unsupported schedule entry type for agreement type ${agreementData.agreementTypeId}`,
              400,
            );
          }
        });

        await Promise.all(ops);

        if (isGrazing) {
          await schedule.fetchGrazingSchedulesEntries(trx);
        } else if (isHayCutting) {
          await schedule.fetchHayCuttingScheduleEntries(trx);
        }

        // Update usage status for this agreement within the transaction
        await processAgreementUsageStatus(trx, agreementId, agreementData.agreementTypeId);
      });

      return res.status(200).json(schedule).end();
    } catch (error) {
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

      await db.transaction().execute(async (trx) => {
        // Get agreement data for usage update
        const agreement = await Agreement.findWithTypeZoneDistrictExemption(trx, {
          'agreement.forest_file_id': agreementId,
        });
        const agreementData = agreement[0];

        // WARNING: This will do a cascading delete on any grazing schedule
        // entries. It will not modify other relations.
        const result = await Schedule.removeById(trx, scheduleId);
        if (result === 0) {
          throw errorWithCode('No such schedule exists', 400);
        }

        // Update usage status for this agreement after schedule deletion
        await processAgreementUsageStatus(trx, agreementId, agreementData.agreementTypeId);
      });
      return res.status(204).end();
    } catch (error) {
      const message = `PlanScheduleController: destroy: fail for id => ${scheduleId}`;
      logger.error(`${message}, with error = ${error.message}`);
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

    try {
      await db.transaction().execute(async (trx) => {
        const agreementId = await Plan.agreementIdForPlanId(trx, planId);
        const agreement = await Agreement.findById(trx, agreementId);

        if (!agreement) {
          throw errorWithCode(`Agreement not found for plan ID ${planId}`, 400);
        }

        await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);

        const agreementTypeId = agreement.agreementTypeId;

        // Map agreement types to the model classes and call the static removeById
        // method on the class so `this.primaryKey` is available inside the method.
        const entryRemovers = {
          1: GrazingScheduleEntry,
          2: GrazingScheduleEntry,
          3: HayCuttingScheduleEntry,
          4: HayCuttingScheduleEntry,
        };

        const removerClass = entryRemovers[agreementTypeId];
        if (!removerClass) {
          throw errorWithCode(`Unsupported agreement type: ${agreementTypeId}`, 400);
        }

        const result = await removerClass.removeById(trx, grazingScheduleEntryId);

        if (result === 0) {
          throw errorWithCode('No such schedule entry exists', 400);
        }

        // Update usage status for this agreement after schedule entry deletion
        await processAgreementUsageStatus(trx, agreementId, agreementTypeId);
      });

      return res.status(204).end();
    } catch (error) {
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

    try {
      await db.transaction().execute(async (trx) => {
        const agreementId = await Plan.agreementIdForPlanId(trx, planId);
        await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);

        if (sortBy) {
          sortBy = objPathToSnakeCase(sortBy.replace('livestockType', 'ref_livestock')).replace('.', '_');
        }

        const result = await trx
          .updateTable('grazing_schedule')
          .set({
            sort_by: sortBy || null,
            sort_order: sortOrder || null,
          })
          .where('id', '=', scheduleId)
          .execute();
        const updated = Number(result[0]?.numUpdatedRows || 0);

        if (updated === 0) {
          throw errorWithCode('No such grazing schedule entry exists', 400);
        }
      });
      return res.status(204).end();
    } catch (error) {
      const message = `PlanScheduleController:updateSortOrder failed for schedule ID: ${scheduleId}`;
      logger.error(`${message}, error: ${error.message}`);
      throw error;
    }
  }
}
