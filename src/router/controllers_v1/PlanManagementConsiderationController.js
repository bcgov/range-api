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
  ManagementConsideration,
} = dm;

export default class PlanManagementConsiderationController {
  /**
   * Create a management consideration
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

      const consideration = await ManagementConsideration.create(db, { ...body, plan_id: planId });

      return res.status(200).json(consideration).end();
    } catch (error) {
      logger.error(`PlanManagementConsiderationController: store: fail with error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a management consideration
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async update(req, res) {
    const { body, params, user } = req;
    const { planId: canonicalId, considerationId } = params;

    checkRequiredFields(
      ['planId', 'considerationId'], 'params', req,
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

      const updated = await ManagementConsideration.update(
        db,
        { canonical_id: considerationId, plan_id: planId },
        { ...body, plan_id: planId },
      );

      return res.status(200).json(updated).end();
    } catch (error) {
      logger.error(`PlanManagementConsiderationController: update: fail with error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a management consideration
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async destroy(req, res) {
    const { params, user } = req;
    const { planId: canonicalId, considerationId } = params;

    checkRequiredFields(
      ['planId', 'considerationId'], 'params', req,
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

      const result = await ManagementConsideration.remove(db, {
        canonical_id: considerationId,
        plan_id: planId,
      });
      if (result === 0) {
        throw errorWithCode('No such management consideration exists', 400);
      }

      return res.status(204).end();
    } catch (error) {
      logger.error(`PlanManagementConsiderationController: destroy: fail with error: ${error.message}`);
      throw error;
    }
  }
}
