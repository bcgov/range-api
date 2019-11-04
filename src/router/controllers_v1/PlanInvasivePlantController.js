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
  InvasivePlantChecklist,
} = dm;

export default class PlanInvasivePlantController {
  /**
   * Create an invasive plant checklist
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async store(req, res) {
    const { body, params, user } = req;
    const { planId: canonicalId } = params;

    checkRequiredFields(
      ['planId'], 'params', req,
    );

    if (!canonicalId) {
      throw errorWithCode('planId must be provided in path', 400);
    }

    const currentPlan = await Plan.findCurrentVersion(db, canonicalId);

    if (!currentPlan) {
      throw errorWithCode('Plan doesn\'t exist', 500);
    }

    const planId = currentPlan.id;

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const ipcl = await InvasivePlantChecklist.findOne(db, { plan_id: planId });
      if (ipcl) {
        throw errorWithCode(`Invasive plant checklist already exist with the plan id ${planId}`);
      }

      const { canonicalId: checklistCanonicalId, ...checklist } = await InvasivePlantChecklist.create(db, { ...body, plan_id: planId });
      return res.status(200).json({ ...checklist, id: checklistCanonicalId }).end();
    } catch (error) {
      logger.error(`PlanInvasivePlantController: store: fail with error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update an invasive plant checklist
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async update(req, res) {
    const { body, params, user } = req;
    const { planId: canonicalId, checklistId } = params;

    checkRequiredFields(
      ['planId', 'checklistId'], 'params', req,
    );

    if (!canonicalId) {
      throw errorWithCode('planId must be provided in path', 400);
    }

    const currentPlan = await Plan.findCurrentVersion(db, canonicalId);

    if (!currentPlan) {
      throw errorWithCode('Plan doesn\'t exist', 404);
    }

    const planId = currentPlan.id;

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const { canonicalId: checklistCanonicalId, ...updatedChecklist } = await InvasivePlantChecklist.update(
        db,
        { canonical_id: checklistId, plan_id: planId },
        body,
      );

      return res.status(200).json({ ...updatedChecklist, id: checklistCanonicalId }).end();
    } catch (error) {
      logger.error(`PlanInvasivePlantController: update: fail with error: ${error.message}`);
      throw error;
    }
  }
}
