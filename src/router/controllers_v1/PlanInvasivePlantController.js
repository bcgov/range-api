import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';

const dm = new DataManager(config);
const { db, Agreement, Plan, InvasivePlantChecklist } = dm;

export default class PlanInvasivePlantController {
  /**
   * Create an invasive plant checklist
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async store(req, res) {
    const { body, params, user } = req;
    const { planId } = params;

    checkRequiredFields(['planId'], 'params', req);

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      const ipcl = await InvasivePlantChecklist.findOne(db, {
        plan_id: planId,
      });
      if (ipcl) {
        throw errorWithCode(
          `Invasive plant checklist already exist with the plan id ${planId}`,
        );
      }

      const checklist = await InvasivePlantChecklist.create(db, {
        ...body,
        plan_id: planId,
      });
      return res.status(200).json(checklist).end();
    } catch (error) {
      logger.error(
        `PlanInvasivePlantController: store: fail with error: ${error.message}`,
      );
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
    const { planId, checklistId } = params;

    checkRequiredFields(['planId', 'checklistId'], 'params', req);

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      delete body.planId;
      delete body.plan_id;

      const updatedChecklist = await InvasivePlantChecklist.update(
        db,
        { id: checklistId },
        body,
      );

      return res.status(200).json(updatedChecklist).end();
    } catch (error) {
      logger.error(
        `PlanInvasivePlantController: update: fail with error: ${error.message}`,
      );
      throw error;
    }
  }
}
