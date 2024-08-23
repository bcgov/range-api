import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';

const dm = new DataManager(config);
const { db, Agreement, Plan, ManagementConsideration } = dm;

export default class PlanManagementConsiderationController {
  /**
   * Create a management consideration
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async store(req, res) {
    const { body, params, user } = req;
    const { planId } = params;

    checkRequiredFields(['planId'], 'params', req);

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const consideration = await ManagementConsideration.create(db, {
        ...body,
        plan_id: planId,
      });

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
    const { planId, considerationId } = params;

    checkRequiredFields(['planId', 'considerationId'], 'params', req);

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const consideration = await ManagementConsideration.update(
        db,
        { id: considerationId },
        { ...body, plan_id: planId },
      );

      return res.status(200).json(consideration).end();
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
    const { planId, considerationId } = params;

    checkRequiredFields(['planId', 'considerationId'], 'params', req);

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const result = await ManagementConsideration.removeById(db, considerationId);
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
