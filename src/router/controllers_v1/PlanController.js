import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import config from '../../config';
import DataManager from '../../libs/db2';
import GrazingSchedule from '../../libs/db2/model/grazingschedule';
import GrazingScheduleEntry from '../../libs/db2/model/grazingscheduleentry';
import InvasivePlantChecklist from '../../libs/db2/model/invasiveplantchecklist';
import ManagementConsideration from '../../libs/db2/model/managementconsideration';
import MinisterIssue from '../../libs/db2/model/ministerissue';
import MinisterIssueAction from '../../libs/db2/model/ministerissueaction';
import MinisterIssuePasture from '../../libs/db2/model/ministerissuepasture';
import Pasture from '../../libs/db2/model/pasture';
import PlanSnapshot from '../../libs/db2/model/plansnapshot';
import PlanStatusHistory from '../../libs/db2/model/planstatushistory';
import { checkRequiredFields, objPathToCamelCase, removeCommonFields } from '../../libs/utils';
import { PlanRouteHelper } from '../helpers';
import { generatePDFResponse } from './PDFGeneration';
import PlanExtensionRequests from '../../libs/db2/model/planextensionrequests';
import PlanStatusController from './PlanStatusController';
import IndicatorPlant from '../../libs/db2/model/indicatorplant';
import MonitoringArea from '../../libs/db2/model/monitoringarea';
import PlantCommunityAction from '../../libs/db2/model/plantcommunityaction';
import PlantCommunity from '../../libs/db2/model/plantcommunity';
import MonitoringAreaPurpose from '../../libs/db2/model/monitoringareapurpose';

const dm = new DataManager(config);
const { db, Plan, Agreement, PlanConfirmation, PlanStatus, AdditionalRequirement, PlanFile } = dm;

const filterFiles = (files, user) =>
  files.filter((file) => {
    switch (file.access) {
      case 'staff_only':
        return user.isRangeOfficer() || user.isAdministrator() || user.isDecisionMaker();
      case 'user_only':
        return file.userId === user.id;
      case 'everyone':
        return true;
      default:
        return false;
    }
  });

export default class PlanController {
  // --
  // Plan Resource / Doc / Table CRUD Operation
  // --
  /**
   * Display plan
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async show(req, res) {
    const { user, params } = req;
    const { planId } = params;

    checkRequiredFields(['planId'], 'params', req);
    const response = await PlanController.fetchPlan(planId, user);
    return res.status(200).json(response).end();
  }

  static async fetchPlan(planId, user) {
    try {
      const [plan] = await Plan.findWithStatusExtension(db, { 'plan.id': planId }, ['id', 'desc']);
      if (!plan) {
        throw errorWithCode("Plan doesn't exist", 404);
      }
      const { agreementId } = plan;
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
      const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(db, { forest_file_id: agreementId });
      await agreement.eagerloadAllOneToManyExceptPlan();
      agreement.transformToV1();
      await plan.eagerloadAllOneToMany();
      plan.agreement = agreement;
      const filteredFiles = filterFiles(plan.files, user);
      const mappedGrazingSchedules = await Promise.all(
        plan.grazingSchedules.map(async (schedule) => {
          let sanitizedSortBy = schedule.sortBy && objPathToCamelCase(schedule.sortBy);
          sanitizedSortBy = sanitizedSortBy && sanitizedSortBy.replace('pastureName', 'pasture.name');
          sanitizedSortBy = sanitizedSortBy && sanitizedSortBy.replace('refLivestockName', 'livestockType.name');
          sanitizedSortBy = sanitizedSortBy && sanitizedSortBy.replace('pldAuMs', 'pldAUMs');
          sanitizedSortBy = sanitizedSortBy && sanitizedSortBy.replace('crownAuMs', 'crownAUMs');
          return {
            ...schedule,
            sortBy: sanitizedSortBy,
          };
        }),
      );
      return {
        ...plan,
        grazingSchedules: mappedGrazingSchedules,
        files: filteredFiles,
      };
    } catch (error) {
      console.log(error.stack);
      logger.error(`Unable to fetch plan, error: ${error.message}`);
      throw errorWithCode(`There was a problem fetching the record. Error: ${error.message}`, error.code || 500);
    }
  }
  /**
   * Create Plan
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async store(req, res) {
    const { body, user } = req;
    const { agreementId } = body;
    checkRequiredFields(['statusId'], 'body', req);

    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

    const agreement = await Agreement.findById(db, agreementId);
    if (!agreement) {
      throw errorWithCode('agreement not found', 404);
    }

    if (Number(body.id) || Number(body.planId)) {
      const plan = await Plan.findById(db, body.id || body.planId);
      if (plan) {
        throw errorWithCode('A plan with this ID exists. Use PUT.', 409);
      }
    }

    // delete the old plan whose status is 'Staff Draft'
    const staffDraftStatus = await PlanStatus.findOne(db, {
      code: 'SD',
    });
    await Plan.remove(db, {
      agreement_id: agreement.id,
      status_id: staffDraftStatus.id,
    });
    const plan = await Plan.create(db, {
      ...body,
      creator_id: user.id,
    });

    // create unsiged confirmations for AHs
    await PlanConfirmation.createConfirmations(db, agreementId, plan.id);

    return res.status(200).json(plan).end();
  }

  /**
   * Update Plan
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async update(req, res) {
    const { params, body, user } = req;
    const { planId } = params;

    checkRequiredFields(['planId'], 'params', req);

    const agreementId = await Plan.agreementIdForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

    // Don't allow the agreement relation to be updated.
    delete body.agreementId;
    await Plan.update(db, { id: planId }, body);
    const [plan] = await Plan.findWithStatusExtension(db, { 'plan.id': planId }, ['id', 'desc']);
    await plan.eagerloadAllOneToMany();

    const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(db, {
      forest_file_id: agreementId,
    });
    await agreement.eagerloadAllOneToManyExceptPlan();
    agreement.transformToV1();
    plan.agreement = agreement;

    return res.status(200).json(plan).end();
  }

  // --
  // Plan Operation based on plan
  // --

  // --
  // Additional requirement
  /**
   * Create Additional requirement
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async storeAdditionalRequirement(req, res) {
    const { body, params, user } = req;
    const { planId } = params;

    checkRequiredFields(['planId'], 'params', req);

    const agreementId = await Plan.agreementIdForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
    const requirement = await AdditionalRequirement.create(db, {
      ...body,
      plan_id: planId,
    });
    return res.status(200).json(requirement).end();
  }

  static async updateAdditionalRequirement(req, res) {
    const { body, params, user } = req;
    const { planId, requirementId } = params;

    checkRequiredFields(['planId', 'requirementId'], 'params', req);

    const agreementId = await Plan.agreementIdForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

    delete body.id;
    delete body.planId;
    delete body.plan_id;

    const requirement = await AdditionalRequirement.findOne(db, {
      id: requirementId,
    });

    if (!requirement) {
      throw errorWithCode("Additional requirement doesn't exist", 404);
    }

    const updatedRequirement = await AdditionalRequirement.update(
      db,
      {
        id: requirementId,
      },
      body,
    );

    res.send(updatedRequirement);
  }

  static async destroyAdditionalRequirement(req, res) {
    const { body, params, user } = req;
    const { planId, requirementId } = params;

    checkRequiredFields(['planId', 'requirementId'], 'params', req);

    const agreementId = await Plan.agreementIdForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

    delete body.id;
    delete body.planId;
    delete body.plan_id;

    const result = await AdditionalRequirement.remove(db, {
      id: requirementId,
    });

    if (result === 0) {
      throw errorWithCode('Could not find additional requirement', 400);
    }

    res.status(204).end();
  }

  static async discardAmendment(req, res) {
    const { params, user } = req;
    const { planId } = params;

    checkRequiredFields(['planId'], 'params', req);

    const plan = await Plan.findById(db, planId);
    if (!plan) {
      throw errorWithCode('Could not find plan', 404);
    }

    if (Plan.isLegal(plan) || !Plan.isAmendment(plan)) {
      throw errorWithCode('This plan is not an amendment, and cannot be discarded.', 400);
    }

    const agreementId = await Plan.agreementIdForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

    const prevLegalVersion = await PlanStatusController.getLatestLegalVersion(planId);
    if (!prevLegalVersion) {
      throw errorWithCode('Could not find previous legal version.', 500);
    }

    logger.info(`Restoring snapshot ID ${prevLegalVersion.id} for plan ${planId}`);

    await Plan.restoreVersion(db, planId, prevLegalVersion.version);

    const versionsToDiscard = await db
      .table('plan_snapshot')
      .select('id')
      .where({ plan_id: planId })
      .andWhereRaw('created_at > ?::timestamp', [prevLegalVersion.created_at.toISOString()]);

    const versionIdsToDiscard = versionsToDiscard.map((v) => v.id);

    logger.info(`Marking as discarded: ${JSON.stringify(versionIdsToDiscard)}`);

    await db.table('plan_snapshot').update({ is_discarded: true }).whereIn('id', versionIdsToDiscard);

    res.status(200).end();
  }

  static async storeAttachment(req, res) {
    const { params, user, body } = req;
    const { planId } = params;

    if (!user || (!user.isRangeOfficer() && !user.isAdministrator())) {
      throw errorWithCode('Unauthorized', 403);
    }

    const agreementId = await Plan.agreementIdForPlanId(db, planId);

    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

    const planFile = await PlanFile.create(db, {
      name: body.name,
      url: body.url,
      type: body.type,
      access: body.access ?? 'staff_only',
      plan_id: planId,
      user_id: user.id,
    });

    res.json(planFile).end();
  }

  static async updateAttachment(req, res) {
    const { params, user, body } = req;
    const { planId, attachmentId } = params;
    if (!user || (!user.isRangeOfficer() && !user.isAdministrator())) {
      throw errorWithCode('Unauthorized', 403);
    }

    const agreementId = await Plan.agreementIdForPlanId(db, planId);

    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
    const planFile = await PlanFile.findById(db, attachmentId);
    if (!planFile) {
      throw errorWithCode('Could not find file', 404);
    }

    const newPlanFile = await PlanFile.update(
      db,
      { id: attachmentId },
      {
        access: body.access ?? 'staff_only',
      },
    );

    res.json(newPlanFile).end();
  }

  static async removeAttachment(req, res) {
    const { params, user } = req;
    const { planId, attachmentId } = params;

    if (!user || (!user.isRangeOfficer() && !user.isAdministrator())) {
      throw errorWithCode('Unauthorized', 403);
    }

    const agreementId = await Plan.agreementIdForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

    const result = await PlanFile.removeById(db, attachmentId);

    if (result === 0) {
      throw errorWithCode('Could not find attachment', 400);
    }

    res.status(204).end();
  }

  static async removeAllWithRelations(trx, planId) {
    try {
      const additionalRequirements = await AdditionalRequirement.find(trx, {
        plan_id: planId,
      });
      for (const additionalRequirement of additionalRequirements) {
        await AdditionalRequirement.removeById(trx, additionalRequirement.id);
      }
      const pastures = await Pasture.find(trx, { plan_id: planId });
      for (const pasture of pastures) {
        await Pasture.removeById(trx, pasture.id);
      }
      const grazingSchedules = await GrazingSchedule.find(trx, {
        plan_id: planId,
      });
      for (const grazingSchedule of grazingSchedules) {
        const grazingScheduleEntries = await GrazingScheduleEntry.find(trx, {
          grazing_schedule_id: grazingSchedule.id,
        });
        for (const grazingScheduleEntry of grazingScheduleEntries) {
          await GrazingScheduleEntry.removeById(trx, grazingScheduleEntry.id);
        }
        await GrazingSchedule.removeById(trx, grazingSchedule.id);
      }
      const ministerIssues = await MinisterIssue.find(trx, { plan_id: planId });
      for (const ministerIssue of ministerIssues) {
        const ministerIssueActions = await MinisterIssueAction.find(trx, {
          issue_id: ministerIssue.id,
        });
        for (const ministerIssueAction of ministerIssueActions) {
          await MinisterIssueAction.removeById(trx, ministerIssueAction.id);
        }
        const ministerIssuePastures = await MinisterIssuePasture.find(trx, {
          minister_issue_id: ministerIssue.id,
        });
        for (const ministerIssuePasture of ministerIssuePastures) {
          await MinisterIssuePasture.removeById(trx, ministerIssuePasture.id);
        }
      }
      const managementConsiderations = await ManagementConsideration.find(trx, {
        plan_id: planId,
      });
      for (const managementConsideration of managementConsiderations) {
        await ManagementConsideration.removeById(trx, managementConsideration.id);
      }
      const planFiles = await PlanFile.find(trx, { plan_id: planId });
      for (const planFile of planFiles) {
        await PlanFile.removeById(trx, planFile.id);
      }
      const invasivePlantChecklist = await InvasivePlantChecklist.findOne(trx, {
        plan_id: planId,
      });
      await InvasivePlantChecklist.removeById(trx, invasivePlantChecklist.id);
      await PlanExtensionRequests.remove(trx, { plan_id: planId });
      await PlanSnapshot.remove(trx, { plan_id: planId });
      await Plan.removeById(trx, planId);
    } catch (exception) {
      logger.error(exception.stack);
      return null;
    }
  }

  static async duplicatePlan(trx, planRow, newPlanProperties, exclusions) {
    const planId = planRow.id;
    removeCommonFields(planRow);
    const newPlan = await Plan.create(trx, {
      ...planRow,
      ...newPlanProperties,
    });
    const additionalRequirements = await AdditionalRequirement.find(trx, {
      plan_id: planId,
    });
    for (const additionalRequirement of additionalRequirements) {
      removeCommonFields(additionalRequirement);
      await AdditionalRequirement.create(trx, {
        ...additionalRequirement,
        planId: newPlan.id,
      });
    }
    const newAndOldPastureIds = [];
    const pastures = await Pasture.find(trx, { plan_id: planId });
    for (const pasture of pastures) {
      const oldPastureId = pasture.id;
      await pasture.fetchPlantCommunities(trx, { pasture_id: pasture.id });
      removeCommonFields(pasture);
      const newPasture = await Pasture.create(trx, {
        ...pasture,
        planId: newPlan.id,
      });
      newAndOldPastureIds.push({
        newPastureId: newPasture.id,
        oldPastureId,
      });
      for (const plantCommunity of pasture.plantCommunities) {
        removeCommonFields(plantCommunity);
        const newPlantCommunity = await PlantCommunity.create(trx, {
          ...plantCommunity,
          pasture_id: newPasture.id,
        });
        newPlantCommunity.indicatorPlants = await Promise.all(
          plantCommunity.indicatorPlants.map((indicatorPlant) => {
            removeCommonFields(indicatorPlant);
            return IndicatorPlant.create(trx, { ...indicatorPlant, plant_community_id: newPlantCommunity.id });
          }),
        );
        newPlantCommunity.plantCommunityActions = await Promise.all(
          plantCommunity.plantCommunityActions.map((plantCommunityAction) => {
            removeCommonFields(plantCommunityAction);
            return PlantCommunityAction.create(trx, {
              ...plantCommunityAction,
              plant_community_id: newPlantCommunity.id,
            });
          }),
        );
        newPlantCommunity.monitoringAreas = await Promise.all(
          plantCommunity.monitoringAreas.map(async (monitoringArea) => {
            const oldMonitoringAreaId = monitoringArea.id;
            removeCommonFields(monitoringArea);
            const newMonitoringArea = await MonitoringArea.create(trx, {
              ...monitoringArea,
              plant_community_id: newPlantCommunity.id,
            });
            const monitoringAreaPurposes = await MonitoringAreaPurpose.find(trx, {
              monitoring_area_id: oldMonitoringAreaId,
            });
            for (const purpose of monitoringAreaPurposes) {
              removeCommonFields(purpose);
              await MonitoringAreaPurpose.create(trx, { ...purpose, monitoring_area_id: newMonitoringArea.id });
            }
            return newMonitoringArea;
          }),
        );
      }
    }
    const grazingSchedules = await GrazingSchedule.find(trx, {
      plan_id: planId,
    });
    for (const grazingSchedule of grazingSchedules) {
      const grazingScheduleEntries = await GrazingScheduleEntry.find(trx, {
        grazing_schedule_id: grazingSchedule.id,
      });
      removeCommonFields(grazingSchedule);
      const newGrazingSchedule = await GrazingSchedule.create(trx, {
        ...grazingSchedule,
        planId: newPlan.id,
      });
      for (const grazingScheduleEntry of grazingScheduleEntries) {
        removeCommonFields(grazingScheduleEntry);
        await GrazingScheduleEntry.create(trx, {
          ...grazingScheduleEntry,
          grazingScheduleId: newGrazingSchedule.id,
          pastureId: newAndOldPastureIds.find((element) => element.oldPastureId === grazingScheduleEntry.pastureId)
            .newPastureId,
        });
      }
    }
    const ministerIssues = await MinisterIssue.find(trx, { plan_id: planId });
    const newAndOldMinisterIssueIds = [];
    for (const ministerIssue of ministerIssues) {
      const oldMinisterIssueId = ministerIssue.id;
      removeCommonFields(ministerIssue);
      const newMinisterIssue = await MinisterIssue.create(trx, {
        ...ministerIssue,
        planId: newPlan.id,
      });
      newAndOldMinisterIssueIds.push({
        newMinisterIssueId: newMinisterIssue.id,
        oldMinisterIssueId,
      });
      const ministerIssueActions = await MinisterIssueAction.find(trx, {
        issue_id: oldMinisterIssueId,
      });
      for (const ministerIssueAction of ministerIssueActions) {
        removeCommonFields(ministerIssueAction);
        await MinisterIssueAction.create(trx, {
          ...ministerIssueAction,
          issueId: newMinisterIssue.id,
        });
      }
      const ministerIssuePastures = await MinisterIssuePasture.find(trx, {
        minister_issue_id: oldMinisterIssueId,
      });
      for (const ministerIssuePasture of ministerIssuePastures) {
        removeCommonFields(ministerIssuePasture);
        await MinisterIssuePasture.create(trx, {
          ...ministerIssuePasture,
          ministerIssueId: newMinisterIssue.id,
          pastureId: newAndOldPastureIds.find((element) => element.oldPastureId === ministerIssuePasture.pastureId)
            .newPastureId,
        });
      }
    }
    if (!exclusions?.excludeManagementConsiderations) {
      const managementConsiderations = await ManagementConsideration.find(trx, {
        plan_id: planId,
      });
      for (const managementConsideration of managementConsiderations) {
        removeCommonFields(managementConsideration);
        await ManagementConsideration.create(trx, {
          ...managementConsideration,
          planId: newPlan.id,
        });
      }
    }
    if (!exclusions?.excludeAttachments) {
      const planFiles = await PlanFile.find(trx, { plan_id: planId });
      for (const planFile of planFiles) {
        removeCommonFields(planFile);
        await PlanFile.create(trx, { ...planFile, planId: newPlan.id });
      }
    }
    const invasivePlantChecklist = await InvasivePlantChecklist.findOne(trx, {
      plan_id: planId,
    });
    removeCommonFields(invasivePlantChecklist);
    await InvasivePlantChecklist.create(trx, {
      ...invasivePlantChecklist,
      planId: newPlan.id,
    });
    return newPlan;
  }
  static async downloadPDF(req, res) {
    const { user, params } = req;
    const { planId } = params;
    const plan = await PlanController.fetchPlan(planId, user);
    plan.originalApproval = await PlanStatusHistory.fetchOriginalApproval(db, planId);
    const amendmentSubmissions = await PlanSnapshot.fetchAmendmentSubmissions(db, planId);
    plan.amendmentSubmissions = amendmentSubmissions.filter((item) => {
      return item.amendmentType !== null;
    });
    const response = await generatePDFResponse(plan);
    res.json(response.data).end();
  }
}
