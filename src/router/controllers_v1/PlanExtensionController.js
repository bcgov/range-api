import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import config from '../../config';
import { PLAN_EXTENSION_STATUS } from '../../constants';
import DataManager from '../../libs/db2';
import PlanFile from '../../libs/db2/model/PlanFile';
import Agreement from '../../libs/db2/model/agreement';
import EmailTemplate from '../../libs/db2/model/emailtemplate';
import GrazingSchedule from '../../libs/db2/model/grazingschedule';
import { Mailer } from '../../libs/mailer';
import { checkRequiredFields, substituteFields } from '../../libs/utils';
import PlanController from './PlanController';
import PlanStatusController from './PlanStatusController';

const dm = new DataManager(config);
const { db, Plan, PlanExtensionRequests } = dm;

export default class PlanExtensionController {
  /**
   * requestExtension
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async approveExtension(req, res) {
    const { params, user, body } = req;
    const { planId } = params;
    const { extensionRequestId } = body;
    checkRequiredFields(['planId'], 'params', req);
    const trx = await db.transaction();
    try {
      const extensionRequest = await PlanExtensionRequests.findOne(db, {
        id: extensionRequestId,
        plan_id: planId,
      });
      if (!extensionRequest) {
        throw errorWithCode("Extension request doesn't exist", 400);
      }
      if (
        !(extensionRequest.userId === user.id) &&
        !user.agentOf.find(({ clientId }) => clientId === extensionRequest.clientId)
      ) {
        throw errorWithCode('Invalid request', 400);
      }
      const planEntry = await Plan.findOne(trx, { id: planId });
      if (planEntry.extensionReceivedVotes >= planEntry.extensionRequiredVotes) {
        throw errorWithCode('All requests already received', 400);
      }
      await PlanExtensionRequests.update(trx, { id: extensionRequestId }, { requestedExtension: true });
      await Plan.update(trx, { id: planId }, { extension_received_votes: planEntry.extensionReceivedVotes + 1 });
      const agreement = (
        await Agreement.findWithTypeZoneDistrictExemption(trx, {
          forest_file_id: planEntry.agreementId,
        })
      )[0];
      if (planEntry.extensionReceivedVotes === planEntry.extensionRequiredVotes + 1) {
        await PlanExtensionController.sendPlanPendingExtensionEmail(trx, [agreement.zone.user.email], {
          '{agreementId}': planEntry.agreementId,
        });
      }
      trx.commit();
      return res.status(200).end();
    } catch (error) {
      logger.error(error.stack);
      trx.rollback();
      return res.status(500).end();
    }
  }
  /**
   * Fetch replacement plan
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async fetchReplacementPlan(req, res) {
    const { user, params } = req;
    const { planId } = params;
    const replacementPlan = await Plan.findOne(db, { replacement_of: planId });
    checkRequiredFields(['planId'], 'params', req);
    if (replacementPlan) {
      const response = await PlanController.fetchPlan(replacementPlan.id, user);
      return res.status(200).json([response]).end();
    }
    return res.status(200).json([]).end();
  }
  /**
   * Create Replacement Plan
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async createReplacementPlan(req, res) {
    const { params } = req;
    const { planId } = params;
    checkRequiredFields(['planId'], 'params', req);
    const trx = await db.transaction();
    try {
      const plan = await Plan.findOne(trx, { id: planId });
      if (!plan) {
        throw errorWithCode(`Could not find plan ${planId}`, 400);
      }
      if (
        ![
          PLAN_EXTENSION_STATUS.AGREEMENT_HOLDER_REJECTED,
          PLAN_EXTENSION_STATUS.DISTRICT_MANAGER_REJECTED,
          PLAN_EXTENSION_STATUS.STAFF_REJECTED,
        ].includes(plan.extensionStatus) &&
        plan.statusId !== 26
      ) {
        throw errorWithCode(`Invalid plan extension status: ${plan.extensionStatus}`, 400);
      }
      const newPlanStartDate = new Date(plan.planEndDate);
      newPlanStartDate.setDate(newPlanStartDate.getDate() + 1);
      const newPlanEndtDate = new Date(newPlanStartDate);
      newPlanEndtDate.setFullYear(newPlanStartDate.getFullYear() + 5);
      newPlanEndtDate.setDate(newPlanEndtDate.getDate() - 1);
      const replacementPlan = await PlanController.duplicatePlan(
        trx,
        plan,
        {
          replacementOf: plan.id,
          replacementPlanId: null,
          planStartDate: newPlanStartDate,
          planEndDate: newPlanEndtDate,
          statusId: 6,
          amendmentTypeId: null,
          extensionStatus: PLAN_EXTENSION_STATUS.INACTIVE_REPLACEMENT_PLAN,
        },
        null,
      );
      await PlanExtensionController.setReplacementPlanGrazingSchedule(trx, replacementPlan);
      await PlanFile.remove(trx, {
        plan_id: replacementPlan.id,
        type: 'decisionAttachments',
      });
      await Plan.update(
        trx,
        { id: planId },
        {
          replacementPlanId: replacementPlan.id,
          extensionStatus: PLAN_EXTENSION_STATUS.REPLACEMENT_PLAN_CREATED,
        },
      );
      trx.commit();
      return res.status(200).json({ replacementPlan: replacementPlan }).end();
    } catch (error) {
      trx.rollback();
      logger.error(error.stack);
      throw errorWithCode(error, 500);
    }
  }

  static async setReplacementPlanGrazingSchedule(trx, plan) {
    const grazingSchedules = await GrazingSchedule.find(
      trx,
      {
        plan_id: plan.id,
      },
      ['year', 'desc'],
    );
    for (const grazingScheduleToRemove of grazingSchedules.slice(1)) {
      await GrazingSchedule.removeById(trx, grazingScheduleToRemove.id);
    }
    if (grazingSchedules[0]) {
      const grazingScheduleYear = plan.planStartDate.getFullYear();
      await GrazingSchedule.update(trx, { id: grazingSchedules[0].id }, { year: grazingScheduleYear });
      await PlanExtensionController.updateGrazingScheduleEntriesYear(trx, grazingSchedules[0].id, grazingScheduleYear);
    }
  }

  static async updateGrazingScheduleEntriesYear(trx, grazingScheduleId, targetYear) {
    // Fetch entries by grazing_schedule_id
    const entries = await trx
      .select('id', 'date_in', 'date_out')
      .from('grazing_schedule_entry')
      .where('grazing_schedule_id', grazingScheduleId);

    // Update each entry
    for (const entry of entries) {
      // Extract original dates
      const dateIn = new Date(entry.date_in);
      const dateOut = new Date(entry.date_out);

      // Construct new dates with the target year
      const updatedDateIn = new Date(targetYear, dateIn.getMonth(), dateIn.getDate());
      const updatedDateOut = new Date(targetYear, dateOut.getMonth(), dateOut.getDate());

      // Update the entry in the database
      await trx('grazing_schedule_entry').where('id', entry.id).update({
        date_in: updatedDateIn,
        date_out: updatedDateOut,
      });
    }
  }

  /**
   * refuseExtension
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async rejectExtension(req, res) {
    const { params, user, body } = req;
    const { planId } = params;
    checkRequiredFields(['planId'], 'params', req);
    let updatedValues = {
      extension_rejected_by: user.id,
    };
    const trx = await db.transaction();
    try {
      const planEntry = await Plan.findOne(trx, { id: planId });
      if (user.isAgreementHolder()) {
        const { extensionRequestId } = body;
        const extensionRequest = await PlanExtensionRequests.findOne(db, {
          id: extensionRequestId,
          plan_id: planId,
        });
        if (!extensionRequest) {
          throw errorWithCode("Extension request doesn't exist", 400);
        }
        if (
          !(extensionRequest.userId === user.id) &&
          !user.agentOf.find(({ clientId }) => clientId === extensionRequest.clientId)
        ) {
          throw errorWithCode('Invalid request', 400);
        }
        if (!planEntry || planEntry.extensionStatus != PLAN_EXTENSION_STATUS.AWAITING_VOTES) {
          throw errorWithCode('Invalid request. Plan may be already extended.', 400);
        }
        if (planEntry.extensionReceivedVotes >= planEntry.extensionRequiredVotes) {
          throw errorWithCode('All requests already accepted', 400);
        }
        await PlanExtensionRequests.update(db, { id: extensionRequest.id }, { requestedExtension: false });
        updatedValues.extension_status = PLAN_EXTENSION_STATUS.AGREEMENT_HOLDER_REJECTED;
        updatedValues.extension_received_votes = planEntry.extensionReceivedVotes + 1;
      }
      if (
        planEntry.extensionStatus !== PLAN_EXTENSION_STATUS.AWAITING_VOTES &&
        planEntry.extensionStatus !== PLAN_EXTENSION_STATUS.AWAITING_EXTENSION
      ) {
        throw errorWithCode(`Invalid plan status ${planEntry.extensionStatus}`, 400);
      }
      if (user.isRangeOfficer() || user.isAdministrator()) {
        updatedValues.extension_status = PLAN_EXTENSION_STATUS.STAFF_REJECTED;
      }
      if (user.isDecisionMaker()) {
        updatedValues.extension_status = PLAN_EXTENSION_STATUS.DISTRICT_MANAGER_REJECTED;
      }
      const response = await Plan.update(db, { id: planId }, updatedValues);
      trx.commit();
      return res.status(200).json({ extensionStatus: response.extensionStatus }).end();
    } catch (error) {
      logger.error(error.stack);
      trx.rollback();
      throw errorWithCode(error, 500);
    }
  }

  static async getPlanEntry(trx, planId, extensionStatus) {
    const planEntry = (
      await Plan.findWithStatusExtension(trx, { 'plan.id': planId, 'plan.extension_status': extensionStatus }, [
        'id',
        'desc',
      ])
    )[0];
    return planEntry;
  }

  /**
   * request extension
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async requestExtension(req, res) {
    const { params, user } = req;
    const { planId } = params;

    checkRequiredFields(['planId'], 'params', req);
    if (!user.isRangeOfficer() && !user.isAdministrator()) {
      throw errorWithCode('Unauthorized', 401);
    }
    const planRow = await Plan.findOne(db, { id: planId, extension_status: 1 });
    if (!planRow) {
      throw errorWithCode('Invalid request. Could not find the plan.', 400);
    }
    if (planRow.extensionReceivedVotes < planRow.extensionRequiredVotes) {
      throw errorWithCode('Need positive votes from all Agreement Holders', 400);
    }
    if (planRow.replacementOf !== null) {
      throw errorWithCode('Plan is an extension', 400);
    }
    const trx = await db.transaction();
    try {
      await Plan.update(trx, { id: planId }, { extensionStatus: PLAN_EXTENSION_STATUS.AWAITING_EXTENSION });
      trx.commit();
      return res.status(200).end();
    } catch (error) {
      logger.error(error.stack);
      trx.rollback();
      throw errorWithCode(error, 500);
    }
  }

  /**
   * extend plan
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async extendPlan(req, res) {
    const { params, user } = req;
    const { planId } = params;
    const { endDate = '' } = req.query;
    if (Number.isNaN(Date.parse(endDate))) {
      throw errorWithCode('Invalid end date', 400);
    }
    checkRequiredFields(['planId'], 'params', req);
    if (!user.isDecisionMaker() && !user.isAdministrator()) {
      throw errorWithCode('Unauthorized', 401);
    }
    const planRow = await Plan.findOne(db, { id: planId, extension_status: 3 });
    if (!planRow) {
      throw errorWithCode('Invalid request. Could not find the plan.', 400);
    }
    if (planRow.extensionReceivedVotes < planRow.extensionRequiredVotes) {
      throw errorWithCode('Need positive votes from all AH', 400);
    }
    if (planRow.replacementOf !== null) {
      throw errorWithCode('Cannot extend replacement plan', 400);
    }
    if (planRow.planEndDate.getTime() >= Date.parse(endDate)) {
      throw errorWithCode('End date must be in future of current end date', 400);
    }
    const trx = await db.transaction();
    try {
      await Plan.update(
        trx,
        { id: planId },
        {
          planEndDate: endDate,
          extensionStatus: PLAN_EXTENSION_STATUS.EXTENDED,
        },
      );
      trx.commit();
      return res.status(200).json({ planId }).end();
    } catch (error) {
      logger.error(error.stack);
      trx.rollback();
      throw errorWithCode(error, 500);
    }
  }

  /**
   * copy plan
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async copyPlan(req, res) {
    const { body, params } = req;
    const { planId } = params;
    const { agreementId, destinationPlanId, createReplacementPlan } = body;
    checkRequiredFields(['planId'], 'params', req);
    checkRequiredFields(['agreementId'], 'body', req);
    const planRow = await Plan.findOne(db, { id: planId });
    if (!planRow) {
      throw errorWithCode('Invalid request. Could not find the plan.', 400);
    }
    let destinationPlan = null;
    if (destinationPlanId) {
      destinationPlan = await Plan.findOne(db, { id: destinationPlanId });
      if (!destinationPlan) {
        throw errorWithCode('Invalid request. Could not find the plan to replace.', 400);
      }
      if (
        PlanStatusController.isPlanActive(destinationPlan.statusId, destinationPlan.amendmentTypeId) &&
        !createReplacementPlan
      )
        throw errorWithCode('Cannot replace an active plan.', 400);
    }
    const agreement = await Agreement.findOne(db, {
      forest_file_id: agreementId,
    });
    if (!agreement) {
      throw errorWithCode('Invalid request. Could not find the agreement.', 400);
    }
    const trx = await db.transaction();
    try {
      const newPlan = await PlanController.duplicatePlan(
        trx,
        planRow,
        {
          agreementId: agreementId,
          statusId: 6,
          amendmentTypeId: null,
          extensionStatus: null,
          replacementPlanId: null,
          replacementOf: null,
        },
        { excludeAttachments: true, excludeManagementConsiderations: true },
      );
      if (destinationPlan) {
        if (createReplacementPlan) {
          if (destinationPlan.replacementPlanId) {
            //Found existing replacement plan so need to delete it
            await PlanController.removeAllWithRelations(trx, destinationPlan.replacementPlanId);
          }
          await Plan.update(
            trx,
            { id: destinationPlan.id },
            {
              replacement_plan_id: newPlan.id,
              extension_status: PLAN_EXTENSION_STATUS.REPLACEMENT_PLAN_CREATED,
            },
          );
          await Plan.update(
            trx,
            { id: newPlan.id },
            {
              replacementOf: destinationPlan.id,
              extension_status: PLAN_EXTENSION_STATUS.INACTIVE_REPLACEMENT_PLAN,
            },
          );
        } else {
          await PlanController.removeAllWithRelations(trx, destinationPlan.id);
        }
      } else {
        if (createReplacementPlan) {
          throw errorWithCode('Invalid request. Cannot create replacement plan without the original plan.', 400);
        }
      }
      // trx.rollback();
      trx.commit();
      return res.status(200).json({ planId: newPlan.id }).end();
    } catch (error) {
      logger.error(error.stack);
      trx.rollback();
      throw errorWithCode(error, 500);
    }
  }

  static async sendPlanPendingExtensionEmail(db, emails, parameters) {
    const template = await EmailTemplate.findOne(db, {
      name: 'Plan Pending Extension',
    });
    const mailer = new Mailer();
    await mailer.sendEmail(
      emails,
      template.fromEmail,
      substituteFields(template.subject, parameters),
      substituteFields(template.body, parameters),
      'html',
    );
  }
}
