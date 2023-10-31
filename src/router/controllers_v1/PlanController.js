import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields, objPathToCamelCase } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';
import { generatePDFResponse } from './PDFGeneration';
import PlanSnapshot from '../../libs/db2/model/plansnapshot';
import PlanStatusHistory from '../../libs/db2/model/planstatushistory';

const dm = new DataManager(config);
const {
  db,
  Plan,
  Agreement,
  PlanConfirmation,
  PlanStatus,
  AdditionalRequirement,
  PlanFile,
} = dm;

const filterFiles = (files, user) => files.filter((file) => {
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
    const {
      user,
      params,
    } = req;
    const { planId } = params;

    checkRequiredFields(
      ['planId'], 'params', req,
    );
    const response = await PlanController.fetchPlan(planId, user);
    return res.status(200)
      .json(response)
      .end();
  }

  static async fetchPlan(planId, user) {
    try {
      const [plan] = await Plan.findWithStatusExtension(db, { 'plan.id': planId }, ['id', 'desc']);
      if (!plan) {
        throw errorWithCode('Plan doesn\'t exist', 404);
      }
      const { agreementId } = plan;
      const statusId = plan?.status?.id;

      const isStaff = user.isAdministrator() || user.isRangeOfficer() || user.isDecisionMaker();

      const [privacyVersionRaw] = await PlanSnapshot.findSummary(db,
        {
          plan_id: planId,
          privacyview: isStaff ? 'StaffView' : 'AHView',
        });
      const privacyVersion = privacyVersionRaw?.snapshot;

      const shouldBeLiveVersion = (privacyVersion == null);

      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(
        db, { forest_file_id: agreementId },
      );
      await agreement.eagerloadAllOneToManyExceptPlan();
      agreement.transformToV1();

      if (shouldBeLiveVersion) {
        await plan.eagerloadAllOneToMany();
        plan.agreement = agreement;

        const filteredFiles = filterFiles(plan.files, user);

        const mappedGrazingSchedules = await Promise.all(
          plan.grazingSchedules.map(async (schedule) => {
            const sanitizedSortBy = schedule.sortBy && objPathToCamelCase(schedule.sortBy);
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
      }

      logger.info('loading last version');

      privacyVersion.status_id = statusId;

      const filteredFiles = filterFiles(privacyVersion.files, user);
      return res.status(200)
        .json({
          ...privacyVersion,
          files: filteredFiles,
          status: plan.status,
          statusId: plan.statusId,
        })
        .end();
    } catch (error) {
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
    const {
      body,
      user,
    } = req;
    const { agreementId } = body;
    checkRequiredFields(
      ['statusId'], 'body', req,
    );

    try {
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const agreement = await Agreement.findById(db, agreementId);
      if (!agreement) {
        throw errorWithCode('agreement not found', 404);
      }

      if (body.id || body.planId) {
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

      return res.status(200)
        .json(plan)
        .end();
    } catch (err) {
      throw err;
    }
  }

  /**
   * Update Plan
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async update(req, res) {
    const {
      params,
      body,
      user,
    } = req;
    const { planId } = params;

    checkRequiredFields(
      ['planId'], 'params', req,
    );

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      // Don't allow the agreement relation to be updated.
      delete body.agreementId;

      await Plan.update(db, { id: planId }, body);
      const [plan] = await Plan.findWithStatusExtension(db, { 'plan.id': planId }, ['id', 'desc']);
      await plan.eagerloadAllOneToMany();

      const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(
        db, { forest_file_id: agreementId },
      );
      await agreement.eagerloadAllOneToManyExceptPlan();
      agreement.transformToV1();
      plan.agreement = agreement;

      return res.status(200)
        .json(plan)
        .end();
    } catch (err) {
      throw err;
    }
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
    const {
      body,
      params,
      user,
    } = req;
    const { planId } = params;

    checkRequiredFields(
      ['planId'], 'params', req,
    );

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
      const requirement = await AdditionalRequirement.create(db, {
        ...body,
        plan_id: planId,
      });
      return res.status(200)
        .json(requirement)
        .end();
    } catch (error) {
      throw error;
    }
  }

  static async updateAdditionalRequirement(req, res) {
    const {
      body,
      params,
      user,
    } = req;
    const {
      planId,
      requirementId,
    } = params;

    checkRequiredFields(['planId', 'requirementId'], 'params', req);

    const agreementId = await Plan.agreementIdForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(
      db,
      Agreement,
      user,
      agreementId,
    );

    delete body.id;
    delete body.planId;
    delete body.plan_id;

    const requirement = await AdditionalRequirement.findOne(db, {
      id: requirementId,
    });

    if (!requirement) {
      throw errorWithCode('Additional requirement doesn\'t exist', 404);
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
    const {
      body,
      params,
      user,
    } = req;
    const {
      planId,
      requirementId,
    } = params;

    checkRequiredFields(['planId', 'requirementId'], 'params', req);

    const agreementId = await Plan.agreementIdForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(
      db,
      Agreement,
      user,
      agreementId,
    );

    delete body.id;
    delete body.planId;
    delete body.plan_id;

    const result = await AdditionalRequirement.remove(
      db,
      {
        id: requirementId,
      },
    );

    if (result === 0) {
      throw errorWithCode('Could not find additional requirement', 400);
    }

    res.status(204)
      .end();
  }

  static async discardAmendment(req, res) {
    const {
      params,
      user,
    } = req;
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

    const prevLegalVersion = await db
      .table('plan_snapshot_summary')
      .whereIn('status_id', Plan.legalStatuses)
      .andWhere({
        plan_id: planId,
      })
      .orderBy('created_at', 'desc')
      .first();

    if (!prevLegalVersion) {
      throw errorWithCode('Could not find previous legal version.', 500);
    }

    logger.info(`Restoring snapshot ID ${prevLegalVersion.id} for plan ${planId}`);

    await Plan.restoreVersion(db, planId, prevLegalVersion.version);

    const versionsToDiscard = await db
      .table('plan_snapshot_summary')
      .select('id')
      .where({ plan_id: planId })
      .andWhereRaw('created_at > ?::timestamp', [prevLegalVersion.created_at.toISOString()]);

    const versionIdsToDiscard = versionsToDiscard.map(v => v.id);

    logger.info(`Marking as discarded: ${JSON.stringify(versionIdsToDiscard)}`);

    await db
      .table('plan_snapshot')
      .update({ is_discarded: true })
      .whereIn('id', versionIdsToDiscard);

    res.status(200)
      .end();
  }

  static async storeAttachment(req, res) {
    const {
      params,
      user,
      body,
    } = req;
    const { planId } = params;

    if (!user || !user.isRangeOfficer()) {
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

    res.json(planFile)
      .end();
  }

  static async updateAttachment(req, res) {
    const {
      params,
      user,
      body,
    } = req;
    const {
      planId,
      attachmentId,
    } = params;

    if (!user || !user.isRangeOfficer()) {
      throw errorWithCode('Unauthorized', 403);
    }

    const agreementId = await Plan.agreementIdForPlanId(db, planId);

    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
    const planFile = await PlanFile.findById(db, attachmentId);
    if (!planFile) {
      throw errorWithCode('Could not find file', 404);
    }

    const newPlanFile = await PlanFile.update(db, { id: attachmentId }, {
      access: body.access ?? 'staff_only',
    });

    res.json(newPlanFile)
      .end();
  }

  static async removeAttachment(req, res) {
    const {
      params,
      user,
    } = req;
    const {
      planId,
      attachmentId,
    } = params;

    if (!user || !user.isRangeOfficer()) {
      throw errorWithCode('Unauthorized', 403);
    }

    const agreementId = await Plan.agreementIdForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

    const result = await PlanFile.removeById(db, attachmentId);

    if (result === 0) {
      throw errorWithCode('Could not find attachment', 400);
    }

    res.status(204)
      .end();
  }

  static async downloadPDF(req, res) {
    const {
      user,
      params,
    } = req;
    const { planId } = params;
    const plan = await PlanController.fetchPlan(planId, user);
    plan.originalApproval = await PlanStatusHistory.fetchOriginalApproval(db, planId);
    const response = await generatePDFResponse(plan);
    res.json(response.data).end();
  }
}