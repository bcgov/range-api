import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';

const dm = new DataManager(config);
const {
  db,
  Plan,
  Agreement,
  PlanVersion,
} = dm;

export default class PlanVersionController {
  static async store(req, res) {
    const { body, user } = req;
    // The "plan id" sent in a request is actually the canonical ID of a resource
    const { planId: canonicalId } = body;

    checkRequiredFields(['planId'], 'body', req);


    // Wrap all queries in a transaction
    try {
      await db.raw('BEGIN');

      const { rows: versionRows } = await db.raw(`
      SELECT plan.*
      FROM plan_version, plan
      WHERE plan_version.canonical_id = ? AND version = -1;
      `, [canonicalId]);

      if (versionRows.length !== 1) {
        throw errorWithCode('Could not find plan', 404);
      }


      const { id: currentPlanId, ...currentPlan } = versionRows[0];

      const agreementId = await Plan.agreementForPlanId(db, currentPlanId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      // TODO: Replace this with duplication logic for ALL tables
      const newPlan = await Plan.create(db, {
        ...currentPlan,
      });

      // Create new plan version record to point to original plan. This will be
      // the point-in-time snapshot of the plan. The original plan should no
      // longer be mutated
      await PlanVersion.create(db, {
        canonicalId,
        planId: currentPlanId,
      });

      // Update current version to point to new plan
      await PlanVersion.update(db, { canonical_id: canonicalId, version: -1 }, {
        planId: newPlan.id,
      });

      await db.raw('COMMIT');
    } catch (error) {
      logger.log(error);
      await db.raw('ROLLBACK');
      throw error;
    }

    return res.status(200).json({ message: 'Created new version' }).end();
  }
}
