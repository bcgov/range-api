import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import config from '../../config';
import { PLAN_EXTENSION_STATUS } from '../../constants';
import DataManager from '../../libs/db2';
import PlanFile from '../../libs/db2/model/PlanFile';
import AdditionalRequirement from '../../libs/db2/model/additionalrequirement';
import Agreement from '../../libs/db2/model/agreement';
import EmailTemplate from '../../libs/db2/model/emailtemplate';
import GrazingSchedule from '../../libs/db2/model/grazingschedule';
import GrazingScheduleEntry from '../../libs/db2/model/grazingscheduleentry';
import InvasivePlantChecklist from '../../libs/db2/model/invasiveplantchecklist';
import ManagementConsideration from '../../libs/db2/model/managementconsideration';
import MinisterIssue from '../../libs/db2/model/ministerissue';
import MinisterIssueAction from '../../libs/db2/model/ministerissueaction';
import MinisterIssuePasture from '../../libs/db2/model/ministerissuepasture';
import Pasture from '../../libs/db2/model/pasture';
import { Mailer } from '../../libs/mailer';
import { checkRequiredFields, substituteFields } from '../../libs/utils';
import PlanController from './PlanController';

const dm = new DataManager(config);
const { db, Plan, PlanExtensionRequests } = dm;

export default class PlanExtensionController {
  /**
   * requestExtension
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async approveExtension(req, res) {
    const { params, user } = req;
    const { planId } = params;
    checkRequiredFields(['planId'], 'params', req);
    const trx = await db.transaction();
    try {
      const extensionRequest = await PlanExtensionRequests.findOne(trx, {
        plan_id: planId,
        user_id: user.id,
      });
      if (!extensionRequest) {
        throw errorWithCode("Extension request doesn't exist", 400);
      }
      const planEntry = await Plan.findOne(trx, { id: planId });
      if (
        planEntry.extensionReceivedVotes >= planEntry.extensionRequiredVotes
      ) {
        throw errorWithCode('All requests already received', 400);
      }
      await PlanExtensionRequests.update(
        trx,
        { plan_id: planId, user_id: user.id },
        { requestedExtension: true },
      );
      await Plan.update(
        trx,
        { id: planId },
        { extension_received_votes: planEntry.extensionReceivedVotes + 1 },
      );
      const agreement = (
        await Agreement.findWithTypeZoneDistrictExemption(trx, {
          forest_file_id: planEntry.agreementId,
        })
      )[0];
      if (
        planEntry.extensionReceivedVotes ===
        planEntry.extensionRequiredVotes + 1
      ) {
        await PlanExtensionController.sendPlanPendingExtensionEmail(
          trx,
          [agreement.zone.user.email],
          {
            '{agreementId}': planEntry.agreementId,
          },
        );
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
        ].includes(plan.extensionStatus)
      ) {
        throw errorWithCode(
          `Invalid plan extension status: ${plan.extensionStatus}`,
          400,
        );
      }
      const newPlanStartDate = new Date(plan.planEndDate);
      newPlanStartDate.setDate(newPlanStartDate.getDate() + 1);
      const newPlanEndtDate = new Date(newPlanStartDate);
      newPlanEndtDate.setFullYear(newPlanStartDate.getFullYear() + 1);
      newPlanEndtDate.setDate(newPlanEndtDate.getDate() - 1);
      const replacementPlan = await PlanExtensionController.duplicatePlan(
        trx,
        plan,
        {
          replacementOf: plan.id,
          replacementPlanId: null,
          planStartDate: newPlanStartDate,
          planEndDate: newPlanEndtDate,
          statusId: 6,
          amendmentTypeId: null,
          extensionStatus: PLAN_EXTENSION_STATUS.INCACTIVE_REPLACEMENT_PLAN,
        },
      );
      await PlanExtensionController.setReplacementPlanGrazingSchedule(
        trx,
        replacementPlan,
      );
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
      await GrazingSchedule.update(
        trx,
        { id: grazingSchedules[0].id },
        { year: plan.planStartDate.getFullYear() },
      );
    }
  }

  /**
   * refuseExtension
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async rejectExtension(req, res) {
    const { params, user } = req;
    const { planId } = params;
    checkRequiredFields(['planId'], 'params', req);
    let updatedValues = {
      extension_rejected_by: user.id,
    };
    const trx = await db.transaction();
    try {
      const planEntry = await Plan.findOne(trx, { id: planId });
      if (user.isAgreementHolder()) {
        const extensionRequest = await PlanExtensionRequests.findOne(db, {
          plan_id: planId,
          user_id: user.id,
        });
        if (!extensionRequest) {
          throw errorWithCode("Extension request doesn't exist", 400);
        }
        if (
          !planEntry ||
          planEntry.extensionStatus != PLAN_EXTENSION_STATUS.AWAITING_VOTES
        ) {
          throw errorWithCode(
            'Invalid request. Plan may be already extended.',
            400,
          );
        }
        if (
          planEntry.extensionReceivedVotes >= planEntry.extensionRequiredVotes
        ) {
          throw errorWithCode('All requests already accepted', 400);
        }
        await PlanExtensionRequests.update(
          db,
          { plan_id: planId, user_id: user.id },
          { requestedExtension: false },
        );
        updatedValues.extension_status =
          PLAN_EXTENSION_STATUS.AGREEMENT_HOLDER_REJECTED;
        updatedValues.extension_received_votes =
          planEntry.extensionReceivedVotes + 1;
      }
      if (
        (user.isRangeOfficer() ||
          user.isAdministrator() ||
          user.isDecisionMaker()) &&
        planEntry.extensionReceivedVotes !== planEntry.extensionRequiredVotes
      ) {
        throw errorWithCode('Pending votes from Agreement Holders', 400);
      }
      if (user.isRangeOfficer() || user.isAdministrator()) {
        if (
          planEntry.extensionStatus !== PLAN_EXTENSION_STATUS.AWAITING_VOTES
        ) {
          throw errorWithCode(
            `Invalid plan status ${planEntry.extensionStatus}`,
            400,
          );
        }
        updatedValues.extension_status = PLAN_EXTENSION_STATUS.STAFF_REJECTED;
      }
      if (user.isDecisionMaker()) {
        if (
          planEntry.extensionStatus !== PLAN_EXTENSION_STATUS.AWAITING_EXTENSION
        ) {
          throw errorWithCode(
            `Invalid plan status ${planEntry.extensionStatus}`,
            400,
          );
        }
        updatedValues.extension_status =
          PLAN_EXTENSION_STATUS.DISTRICT_MANAGER_REJECTED;
      }
      const response = await Plan.update(db, { id: planId }, updatedValues);
      trx.commit();
      return res
        .status(200)
        .json({ extensionStatus: response.extensionStatus })
        .end();
    } catch (error) {
      logger.error(error.stack);
      trx.rollback();
      throw errorWithCode(error, 500);
    }
  }

  static async getPlanEntry(trx, planId, extensionStatus) {
    const planEntry = (
      await Plan.findWithStatusExtension(
        trx,
        { 'plan.id': planId, 'plan.extension_status': extensionStatus },
        ['id', 'desc'],
      )
    )[0];
    return planEntry;
  }

  static removeCommonFields(row) {
    delete row.id;
    delete row.createdAt;
    delete row.updatedAt;
    delete row.canonicalId;
  }

  static async duplicatePlan(trx, planRow, newPlanProperties) {
    const planId = planRow.id;
    PlanExtensionController.removeCommonFields(planRow);
    try {
      const newPlan = await Plan.create(trx, {
        ...planRow,
        ...newPlanProperties,
      });
      const additionalRequirements = await AdditionalRequirement.find(trx, {
        plan_id: planId,
      });
      for (const additionalRequirement of additionalRequirements) {
        PlanExtensionController.removeCommonFields(additionalRequirement);
        await AdditionalRequirement.create(trx, {
          ...additionalRequirement,
          planId: newPlan.id,
        });
      }
      const newAndOldPastureIds = [];
      const pastures = await Pasture.find(trx, { plan_id: planId });
      for (const pasture of pastures) {
        const oldPastureId = pasture.id;
        PlanExtensionController.removeCommonFields(pasture);
        const newPasture = await Pasture.create(trx, {
          ...pasture,
          planId: newPlan.id,
        });
        newAndOldPastureIds.push({
          newPastureId: newPasture.id,
          oldPastureId,
        });
      }
      const grazingSchedules = await GrazingSchedule.find(trx, {
        plan_id: planId,
      });
      for (const grazingSchedule of grazingSchedules) {
        const grazingScheduleEntries = await GrazingScheduleEntry.find(trx, {
          grazing_schedule_id: grazingSchedule.id,
        });
        PlanExtensionController.removeCommonFields(grazingSchedule);
        const newGrazingSchedule = await GrazingSchedule.create(trx, {
          ...grazingSchedule,
          planId: newPlan.id,
        });
        for (const grazingScheduleEntry of grazingScheduleEntries) {
          PlanExtensionController.removeCommonFields(grazingScheduleEntry);
          await GrazingScheduleEntry.create(trx, {
            ...grazingScheduleEntry,
            grazingScheduleId: newGrazingSchedule.id,
            pastureId: newAndOldPastureIds.find(
              (element) =>
                element.oldPastureId === grazingScheduleEntry.pastureId,
            ).newPastureId,
          });
        }
      }
      const ministerIssues = await MinisterIssue.find(trx, { plan_id: planId });
      const newAndOldMinisterIssueIds = [];
      for (const ministerIssue of ministerIssues) {
        const oldMinisterIssueId = ministerIssue.id;
        PlanExtensionController.removeCommonFields(ministerIssue);
        const newMinisterIssue = await MinisterIssue.create(trx, {
          ...ministerIssue,
          planId: newPlan.id,
        });
        newAndOldMinisterIssueIds.push({
          newMinisterIssueId: newMinisterIssue.id,
          oldMinisterIssueId,
        });
        const ministerIssueActions = await MinisterIssueAction.find(trx, {
          issue_id: ministerIssue.id,
        });
        for (const ministerIssueAction of ministerIssueActions) {
          PlanExtensionController.removeCommonFields(ministerIssueAction);
          await MinisterIssueAction.create(trx, {
            ...ministerIssueAction,
            issueId: newMinisterIssue.id,
          });
        }
        const ministerIssuePastures = await MinisterIssuePasture.find(trx, {
          issue_id: ministerIssue.id,
        });
        for (const ministerIssuePasture of ministerIssuePastures) {
          PlanExtensionController.removeCommonFields(ministerIssuePasture);
          await MinisterIssuePasture.create(trx, {
            ...ministerIssuePasture,
            ministerIssueId: newMinisterIssue.id,
            pastureId: newAndOldPastureIds.find(
              (element) =>
                element.oldPastureId === ministerIssuePasture.pastureId,
            ).newPastureId,
          });
        }
      }
      const managementConsiderations = await ManagementConsideration.find(trx, {
        plan_id: planId,
      });
      for (const managementConsideration of managementConsiderations) {
        PlanExtensionController.removeCommonFields(managementConsideration);
        await ManagementConsideration.create(trx, {
          ...managementConsideration,
          planId: newPlan.id,
        });
      }
      const planFiles = await PlanFile.find(trx, { plan_id: planId });
      for (const planFile of planFiles) {
        PlanExtensionController.removeCommonFields(planFile);
        await PlanFile.create(trx, { ...planFile, planId: newPlan.id });
      }
      const invasivePlantChecklist = await InvasivePlantChecklist.findOne(trx, {
        plan_id: planId,
      });
      PlanExtensionController.removeCommonFields(invasivePlantChecklist);
      await InvasivePlantChecklist.create(trx, {
        ...invasivePlantChecklist,
        planId: newPlan.id,
      });
      return newPlan;
    } catch (exception) {
      logger.error(exception.stack);
      return null;
    }
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
      throw errorWithCode(
        'Need positive votes from all Agreement Holders',
        400,
      );
    }
    if (planRow.replacementOf !== null) {
      throw errorWithCode('Plan is an extension', 400);
    }
    const trx = await db.transaction();
    try {
      await Plan.update(trx, { id: planId }, { extensionStatus: 3 });
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
      throw errorWithCode(
        'End date must be in future of current end date',
        400,
      );
    }
    const trx = await db.transaction();
    try {
      await Plan.update(
        trx,
        { id: planId },
        {
          extensionStatus: PLAN_EXTENSION_STATUS.EXTENDED,
          statusId: 6,
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
