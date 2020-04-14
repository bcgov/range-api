import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';
import PlanSnapshot from '../../libs/db2/model/plansnapshot';

const dm = new DataManager(config);
const {
  db,
  Plan,
  Agreement,
} = dm;

export default class PlanVersionController {
  static async store(req, res) {
    const { user, params } = req;
    const { planId } = params;

    checkRequiredFields(['planId'], 'params', req);
    const userId = user.id

    try {
      const plan = await Plan.findById(db, planId);
      if (!plan) {
        throw errorWithCode('Could not find plan', 404);
      }

      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const snapshot = await Plan.createSnapshot(db, planId,userId);

      return res.status(200).json(snapshot).end();
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  static async showAll(req, res) {
    const { user, params } = req;
    const { planId } = params;

    checkRequiredFields(['planId'], 'params', req);

    try {
      const plan = await Plan.findById(db, planId);
      if (!plan) {
        throw errorWithCode('Could not find plan', 404);
      }

      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const versions = await PlanSnapshot.find(
        db,
        { plan_id: planId },
      );

      await Promise.all(versions.map(v => v.fetchStatus(db)));

      return res.status(200).json({ versions }).end();
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  static async show(req, res) {
    const { user, params } = req;
    const { planId, version } = params;

    checkRequiredFields(['planId', 'version'], 'params', req);

    try {
      const versionData = await PlanSnapshot.findOne(
        db,
        { plan_id: planId, version },
      );

      if (!versionData) {
        throw errorWithCode('Could not find version for plan', 404);
      }

      const agreementId = await Plan.agreementForPlanId(db, versionData.planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      return res.json({ ...versionData.snapshot, version: versionData.version }).end();
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }


  static async restoreVersion(req, res) {
    const { user, params } = req;
    const { planId, version } = params;

    try {
      const plan = await Plan.findById(db, planId);
      if (!plan) {
        throw errorWithCode('Could not find plan', 404);
      }

      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      await Plan.restoreVersion(db, planId, version);

      res.status(200).end();
    } catch (error) {
      throw error;
    }
  }
}
