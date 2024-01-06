import { errorWithCode } from "@bcgov/nodejs-common-utils";
import config from "../../config";
import DataManager from "../../libs/db2";
import PlanFile from "../../libs/db2/model/PlanFile";
import AdditionalRequirement from "../../libs/db2/model/additionalrequirement";
import GrazingSchedule from "../../libs/db2/model/grazingschedule";
import GrazingScheduleEntry from "../../libs/db2/model/grazingscheduleentry";
import InvasivePlantChecklist from "../../libs/db2/model/invasiveplantchecklist";
import ManagementConsideration from "../../libs/db2/model/managementconsideration";
import MinisterIssue from "../../libs/db2/model/ministerissue";
import MinisterIssueAction from "../../libs/db2/model/ministerissueaction";
import MinisterIssuePasture from "../../libs/db2/model/ministerissuepasture";
import Pasture from "../../libs/db2/model/pasture";
import PlanStatusHistory from "../../libs/db2/model/planstatushistory";
import { checkRequiredFields, substituteFields } from "../../libs/utils";
import { Mailer } from "../../libs/mailer";
import Agreement from "../../libs/db2/model/agreement";
import EmailTemplate from "../../libs/db2/model/emailtemplate";

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
    checkRequiredFields(["planId"], "params", req);
    const trx = await db.transaction();
    try {
      const extensionRequest = await PlanExtensionRequests.findOne(trx, {
        plan_id: planId,
        user_id: user.id,
      });
      if (!extensionRequest)
        throw errorWithCode("Extension request doesn't exist", 400);
      const planEntry = (
        await Plan.findWithStatusExtension(trx, { "plan.id": planId }, [
          "id",
          "desc",
        ])
      )[0];
      if (
        planEntry.extensionReceivedVotes >= planEntry.extensionRequiredVotes
      ) {
        throw errorWithCode("All requests already received", 400);
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
      await PlanExtensionController.sendPlanReadyForExtensionEmail(
        trx,
        [agreement.zone.user.email],
        {
          "{agreementId}": planEntry.agreementId,
        },
      );
      trx.commit();
      console.log("Returning....");
      return res.status(200).end();
    } catch (error) {
      console.error(error.stack);
      trx.rollback();
      return res.status(500).end();
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

    checkRequiredFields(["planId"], "params", req);

    const extensionRequest = await PlanExtensionRequests.findOne(db, {
      plan_id: planId,
      user_id: user.id,
    });
    if (!extensionRequest)
      throw errorWithCode("Extension request doesn't exist", 400);
    const planEntry = await Plan.findOne(db, { id: planId });
    if (planEntry.extensionReceivedVotes >= planEntry.extensionRequiredVotes) {
      throw errorWithCode("All requests already accepted", 400);
    }
    await PlanExtensionRequests.update(
      db,
      { plan_id: planId, user_id: user.id },
      { requestedExtension: false },
    );
    await Plan.update(
      db,
      { id: planId },
      {
        extension_received_votes: planEntry.extensionReceivedVotes + 1,
        extnesion_status: 2,
      },
    );
    return res.status(200).end();
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
    const newPlan = await Plan.create(trx, {
      ...planRow,
      ...newPlanProperties,
      extensionOf: planId,
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
        oldPastureId: oldPastureId,
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
        oldMinisterIssueId: oldMinisterIssueId,
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
  }

  /**
   * extend plan
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async extendPlan(req, res) {
    const { params, user } = req;
    const { planId } = params;

    checkRequiredFields(["planId"], "params", req);

    const planRow = await Plan.findOne(db, { id: planId });
    if (!(user.isRangeOfficer() && user.isAdministrator())) {
      throw errorWithCode("Unauthorized", 401);
    }
    if (planRow.extensionReceivedVotes < planRow.extensionRequiredVotes) {
      throw errorWithCode("Need positive votes from all AH", 400);
    }
    if (planRow.extensionOf !== null) {
      throw errorWithCode("Cannot extend extension plan", 400);
    }
    const trx = await db.transaction();
    try {
      await Plan.update(
        trx,
        { id: planId },
        { extensionStatus: 3, statusId: 6 },
      );
      await PlanStatusHistory.create(trx, {
        fromPlanStatusId: planRow.statusId,
        toPlanStatusId: 6,
        note: " ",
        planId: planId,
        userId: user.id,
      });
      const futuredate = planRow.planEndDate;
      futuredate.setFullYear(futuredate.getFullYear() + 5);
      const newPlan = await PlanExtensionController.duplicatePlan(
        trx,
        planRow,
        {
          statusId: 6,
          amendmentTypeId: null,
          extensionStatus: 4,
          planEndDate: futuredate,
        },
      );
      await Plan.update(trx, { id: newPlan.id }, { statusId: 12 });
      await PlanStatusHistory.create(trx, {
        fromPlanStatusId: 6,
        toPlanStatusId: 12,
        note: " ",
        planId: newPlan.id,
        userId: user.id,
      });
      await Plan.createSnapshot(trx, newPlan.id, user);
      // sendPlanExtendedEmail(trx, {
      //   agreementId: newPlan.agreementId,
      //   planEndDate: newPlan.planEndDate,
      // });
      trx.commit();
      return res.status(200).json({ newPlanId: newPlan.id }).end();
    } catch (error) {
      trx.rollback();
      console.log(error.stack);
      throw errorWithCode(error, 500);
    }
  }

  static async sendPlanReadyForExtensionEmail(db, emails, parameters) {
    const template = await EmailTemplate.findOne(db, {
      name: "Request Plan Extension Votes",
    });
    const mailer = new Mailer();
    await mailer.sendEmail(
      emails,
      template.fromEmail,
      substituteFields(template.subject, parameters),
      substituteFields(template.body, parameters),
      "html",
    );
  }
}