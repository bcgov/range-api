import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields, objPathToSnakeCase } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';

const dm = new DataManager(config);
const {
  db,
  Agreement,
  Plan,
  GrazingSchedule,
  GrazingScheduleEntry,
} = dm;

export default class PlanScheduleController {
  /**
   * Create a schedule for existing plan
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async store(req, res) {
    const { params, body, user } = req;
    const { planId } = params;
    const { grazingScheduleEntries } = body;

    checkRequiredFields(
      ['planId'], 'params', req,
    );
    checkRequiredFields(
      ['grazingScheduleEntries'], 'body', req,
    );

    grazingScheduleEntries.forEach((entry) => {
      if (!entry.livestockTypeId) {
        throw errorWithCode('grazingScheduleEntries must have livestockType');
      }
    });

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      // Use the planId from the URL so that we know exactly what plan
      // is being updated and to ensure its not reassigned.
      delete body.planId;
      delete body.plan_id;

      // TODO:(jl) Wrap this in a transaction so that its an all
      // or nothing created.
      const schedule = await GrazingSchedule.create(db, {
        ...body,
        plan_id: planId,
        sort_by: body.sortBy && objPathToSnakeCase(body.sortBy),
      });
      // eslint-disable-next-line arrow-body-style
      const promises = grazingScheduleEntries.map(async (entry) => {
        return GrazingScheduleEntry.create(db, {
          ...entry,
          grazing_schedule_id: schedule.id,
          pasture_id: entry.pastureId,
          livestock_count: entry.livestockCount.toString(),
        });
      });

      await Promise.all(promises);
      await schedule.fetchGrazingSchedulesEntries();

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
    const { grazingScheduleEntries } = body;
    const { planId, scheduleId } = params;

    checkRequiredFields(
      ['planId', 'scheduleId'], 'params', req,
    );
    checkRequiredFields(
      ['grazingScheduleEntries'], 'body', req,
    );

    grazingScheduleEntries.forEach((entry) => {
      if (!entry.livestockTypeId) {
        throw errorWithCode('grazingScheduleEntries must have livestockType');
      }
    });

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      // Use the planId from the URL so that we know exactly what plan
      // is being updated and to ensure its not reassigned.
      delete body.planId;
      delete body.plan_id;

      const { sortBy } = body;

      // TODO:(jl) Wrap this in a transaction so that its an all
      // or nothing create.
      const schedule = await GrazingSchedule.update(
        db,
        { id: scheduleId },
        {
          ...body,
          plan_id: planId,
          sort_by: sortBy && objPathToSnakeCase(sortBy),
        },
      );
      // eslint-disable-next-line arrow-body-style
      const promises = grazingScheduleEntries.map(async (entry) => {
        delete entry.scheduleId; // eslint-disable-line no-param-reassign
        delete entry.schedule_id; // eslint-disable-line no-param-reassign

        if (entry.id) {
          const { id, ...entryData } = entry;
          return GrazingScheduleEntry.update(
            db,
            { id: entry.id },
            { ...entryData,
              grazing_schedule_id: schedule.id,
              pasture_id: entry.pastureId,
            },
          );
        }

        return GrazingScheduleEntry.create(
          db,
          {
            ...entry,
            grazing_schedule_id: schedule.id,
            pasture_id: entry.pastureId,
            livestock_count: entry.livestockCount.toString(),
          },
        );
      });

      await Promise.all(promises);
      await schedule.fetchGrazingSchedulesEntries();

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

    checkRequiredFields(
      ['planId', 'scheduleId'], 'params', req,
    );

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      // WARNING: This will do a cascading delete on any grazing schedule
      // entries. It will not modify other relations.
      const result = await GrazingSchedule.removeById(db, scheduleId);
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

    checkRequiredFields(
      ['planId', 'scheduleId'], 'params', req,
    );

    checkRequiredFields(
      ['livestockTypeId'], 'body', req,
    );

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
      // Use the planId from the URL so that we know exactly what plan
      // is being updated and to ensure its not reassigned.
      delete body.planId;
      delete body.plan_id;

      const schedule = await GrazingSchedule.findById(db, scheduleId);

      // Unit test defect fix: Check schedule exists
      if (!schedule) {
        throw errorWithCode('No such schedule exists', 400);
      }

      const entry = await GrazingScheduleEntry.create(db, {
        ...body,
        grazing_schedule_id: schedule.id,
      });

      return res.status(200).json(entry).end();
    } catch (error) {
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

    checkRequiredFields(
      ['planId', 'scheduleId', 'grazingScheduleEntryId'], 'params', req,
    );

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
      // WARNING: This will do a cascading delete on any grazing schedule
      // entries. It will not modify other relations.
      const result = await GrazingScheduleEntry.removeById(db, grazingScheduleEntryId);
      if (result === 0) {
        throw errorWithCode('No such grazing schedule entry exists', 400);
      }

      return res.status(204).end();
    } catch (error) {
      const message = `PlanScheduleController:destroyScheduleEntry: fail for id => ${grazingScheduleEntryId}`;
      logger.error(`${message}, with error = ${error.message}`);

      throw error;
    }
  }
}
