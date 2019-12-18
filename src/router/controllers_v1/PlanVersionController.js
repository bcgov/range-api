import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { mapDeep } from 'deepdash/standalone';
import { checkRequiredFields, deepMapKeys } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';

const dm = new DataManager(config);
const {
  db,
  Plan,
  Agreement,
  PlanVersion,
  Pasture,
} = dm;

export default class PlanVersionController {
  static async store(req, res) {
    const { user, params } = req;
    // The "plan id" sent in a request is actually the canonical ID of a resource
    const { planId: canonicalId } = params;

    checkRequiredFields(['planId'], 'params', req);


    try {
      const currentPlan = await Plan.findCurrentVersion(db, canonicalId);
      if (!currentPlan) {
        throw errorWithCode('Could not find plan', 404);
      }

      const { id: currentPlanId } = currentPlan;

      const agreementId = await Plan.agreementForPlanId(db, currentPlanId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const newPlan = await Plan.duplicateAll(db, currentPlanId);

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

      return res.status(200).json(newPlan).end();
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  static async showAll(req, res) {
    const { user, params } = req;
    // The "plan id" sent in a request is actually the canonical ID of a resource
    const { planId: canonicalId } = params;

    checkRequiredFields(['planId'], 'params', req);

    try {
      const currentPlan = await Plan.findCurrentVersion(db, canonicalId);
      if (!currentPlan) {
        throw errorWithCode('Could not find plan', 404);
      }

      const { id: currentPlanId } = currentPlan;

      const agreementId = await Plan.agreementForPlanId(db, currentPlanId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const versions = await PlanVersion.find(
        db,
        { canonical_id: canonicalId },
      );

      return res.status(200).json({ versions }).end();
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  static async show(req, res) {
    const { user, params } = req;
    // The "plan id" sent in a request is actually the canonical ID of a resource
    const { planId: canonicalId, version } = params;

    checkRequiredFields(['planId', 'version'], 'params', req);

    try {
      const versionData = await PlanVersion.findOne(
        db,
        { canonical_id: canonicalId, version },
      );

      if (!versionData) {
        throw errorWithCode('Could not find version for plan', 404);
      }

      const { planId, version: planVersion } = versionData;

      const [plan] = await Plan.findWithStatusExtension(db, { 'plan.id': planId }, ['id', 'desc']);
      if (!plan) {
        throw errorWithCode('Could not find plan', 404);
      }

      const agreementId = await Plan.agreementForPlanId(db, plan.id);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(
        db, { forest_file_id: agreementId },
      );
      await agreement.eagerloadAllOneToManyExceptPlan();
      agreement.transformToV1();

      await plan.eagerloadAllOneToMany();

      const formattedPlanData = deepMapKeys(plan, key => (key === 'canonicalId' ? 'id' : key));

      const mappedPlanData = mapDeep(formattedPlanData, (val, key) =>
        (key === 'planId' ? plan.canonicalId : val));

      const mappedGrazingSchedules = await Promise.all(
        mappedPlanData.grazingSchedules.map(async schedule => ({
          ...schedule,
          grazingScheduleEntries: await Promise.all(
            schedule.grazingScheduleEntries.map(async (entry) => {
              const pasture = await Pasture.findById(db, entry.pastureId);

              return {
                ...entry,
                pastureId: pasture.canonicalId,
              };
            }),
          ),
        })),
      );

      const mappedMinisterIssues = await Promise.all(
        mappedPlanData.ministerIssues.map(async issue => ({
          ...issue,
          pastures: await Promise.all(issue.pastures.map(async (pastureId) => {
            const pasture = await Pasture.findOne(db, { id: pastureId });
            return pasture.canonicalId;
          })),
        })),
      );

      return res.status(200).json({
        ...mappedPlanData,
        grazingSchedules: mappedGrazingSchedules,
        ministerIssues: mappedMinisterIssues,
        version: planVersion,
        agreement,
      }).end();
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
}
