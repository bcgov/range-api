import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
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
  Pasture,
} = dm;

export default class PlanScheduleController {
  /**
   * Create a schedule for existing plan
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async store(req, res) {
    const { params, body, user } = req;
    const { planId: canonicalId } = params;
    const { grazingScheduleEntries } = body;

    checkRequiredFields(
      ['planId'], 'params', req,
    );
    checkRequiredFields(
      ['grazingScheduleEntries'], 'body', req,
    );

    if (!canonicalId) {
      throw errorWithCode('planId must be provided in path', 400);
    }

    const currentPlan = await Plan.findCurrentVersion(db, canonicalId);

    if (!currentPlan) {
      throw errorWithCode('Plan doesn\'t exist', 500);
    }

    const planId = currentPlan.id;

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
      const schedule = await GrazingSchedule.create(db, { ...body, ...{ plan_id: planId } });
      // eslint-disable-next-line arrow-body-style
      const promises = grazingScheduleEntries.map(async (entry) => {
        const pasture = await Pasture.findOne(db, {
          canonical_id: entry.pastureId,
          plan_id: planId,
        });

        return GrazingScheduleEntry.create(db, {
          ...entry,
          grazing_schedule_id: schedule.id,
          pasture_id: pasture.id,
        });
      });

      await Promise.all(promises);
      await schedule.fetchGrazingSchedulesEntries();

      const { canonicalId: scheduleCanonicalId, ...newSchedule } = schedule;
      const entries = schedule.grazingScheduleEntries.map(({ canonicalId: entryCanonicalId, ...entry }) => ({ ...entry, id: entryCanonicalId }));

      return res.status(200).json({ ...newSchedule, id: scheduleCanonicalId, grazingScheduleEntries: entries }).end();
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
    const { planId: canonicalId, scheduleId } = params;

    checkRequiredFields(
      ['planId', 'scheduleId'], 'params', req,
    );
    checkRequiredFields(
      ['grazingScheduleEntries'], 'body', req,
    );

    if (!canonicalId) {
      throw errorWithCode('planId must be provided in path', 404);
    }

    const currentPlan = await Plan.findCurrentVersion(db, canonicalId);

    if (!currentPlan) {
      throw errorWithCode('Plan doesn\'t exist', 500);
    }

    const planId = currentPlan.id;

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
      // or nothing create.
      const schedule = await GrazingSchedule.update(
        db,
        { canonical_id: scheduleId, plan_id: planId },
        { ...body, plan_id: planId },
      );
      // eslint-disable-next-line arrow-body-style
      const promises = grazingScheduleEntries.map(async (entry) => {
        delete entry.scheduleId; // eslint-disable-line no-param-reassign
        delete entry.schedule_id; // eslint-disable-line no-param-reassign

        const pasture = await Pasture.findOne(db, {
          canonical_id: entry.pastureId,
          plan_id: planId,
        });

        if (entry.id) {
          const { id, ...entryData } = entry;
          return GrazingScheduleEntry.update(
            db,
            { canonical_id: entry.id, grazing_schedule_id: schedule.id },
            { ...entryData,
              grazing_schedule_id: schedule.id,
              pasture_id: pasture.id,
            },
          );
        }

        return GrazingScheduleEntry.create(
          db,
          { ...entry, grazing_schedule_id: schedule.id, pasture_id: pasture.id },
        );
      });

      await Promise.all(promises);
      await schedule.fetchGrazingSchedulesEntries();

      const { canonicalId: scheduleCanonicalId, ...updatedSchedule } = schedule;
      const entries = schedule.grazingScheduleEntries.map(({ canonicalId: entryCanonicalId, ...entry }) => ({ ...entry, id: entryCanonicalId }));

      return res.status(200).json({ ...updatedSchedule, id: scheduleCanonicalId, grazingScheduleEntries: entries }).end();
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
    const { planId: canonicalId, scheduleId } = params;

    checkRequiredFields(
      ['planId', 'scheduleId'], 'params', req,
    );

    if (!canonicalId) {
      throw errorWithCode('planId must be provided in path', 404);
    }

    const currentPlan = await Plan.findCurrentVersion(db, canonicalId);

    if (!currentPlan) {
      throw errorWithCode('Plan doesn\'t exist', 500);
    }

    const planId = currentPlan.id;

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      // WARNING: This will do a cascading delete on any grazing schedule
      // entries. It will not modify other relations.
      const result = await GrazingSchedule.remove(db, {
        canonical_id: scheduleId,
        plan_id: planId,
      });
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
    const { planId: canonicalId, scheduleId } = params;

    checkRequiredFields(
      ['planId', 'scheduleId'], 'params', req,
    );

    checkRequiredFields(
      ['livestockTypeId'], 'body', req,
    );

    if (!canonicalId) {
      throw errorWithCode('planId must be provided in path', 404);
    }

    const currentPlan = await Plan.findCurrentVersion(db, canonicalId);

    if (!currentPlan) {
      throw errorWithCode('Plan doesn\'t exist', 500);
    }

    const planId = currentPlan.id;

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
      // Use the planId from the URL so that we know exactly what plan
      // is being updated and to ensure its not reassigned.
      delete body.planId;
      delete body.plan_id;

      const schedule = await GrazingSchedule.findOne(db, {
        plan_id: planId, canonical_id: scheduleId,
      });

      // Unit test defect fix: Check schedule exists
      if (!schedule) {
        throw errorWithCode('No such schedule exists', 400);
      }

      const pasture = await Pasture.findOne(db, { canonical_id: body.pastureId, plan_id: planId });

      const { canonicalId: entryCanonicalId, ...entry } = await GrazingScheduleEntry.create(db, {
        ...body,
        grazing_schedule_id: schedule.id,
        pasture_id: pasture.id,
      });

      return res.status(200).json({ ...entry, id: entryCanonicalId }).end();
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
    const { planId: canonicalId, scheduleId, grazingScheduleEntryId } = params;

    checkRequiredFields(
      ['planId', 'scheduleId', 'grazingScheduleEntryId'], 'params', req,
    );

    if (!canonicalId) {
      throw errorWithCode('planId must be provided in path', 404);
    }

    const currentPlan = await Plan.findCurrentVersion(db, canonicalId);

    if (!currentPlan) {
      throw errorWithCode('Plan doesn\'t exist', 500);
    }

    const planId = currentPlan.id;

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
      const schedule = await GrazingSchedule.findOne(db, {
        plan_id: planId, canonical_id: scheduleId,
      });
      // WARNING: This will do a cascading delete on any grazing schedule
      // entries. It will not modify other relations.
      const result = await GrazingScheduleEntry.remove(db, {
        grazing_schedule_id: schedule.id,
        canonical_id: grazingScheduleEntryId,
      });
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
