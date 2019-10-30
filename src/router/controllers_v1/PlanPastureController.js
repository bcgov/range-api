import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PLANT_COMMUNITY_CRITERIA, PURPOSE_OF_ACTION } from '../../constants';
import { PlanRouteHelper } from '../helpers';

const dm = new DataManager(config);
const {
  db,
  Agreement,
  Plan,
  Pasture,
  PlantCommunity,
  PlantCommunityAction,
  IndicatorPlant,
  MonitoringArea,
  MonitoringAreaPurpose,
} = dm;

export default class PlanPastureController {
  /**
   * Create Pasture for a given plan
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async store(req, res) {
    const { params: { planId }, body, user } = req;

    if (!planId) {
      throw errorWithCode('planId must be provided in path', 400);
    }

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      // Use the planId from the URL so that we know exactly what plan
      // is being updated.
      delete body.planId;
      delete body.plan_id;

      const pasture = await Pasture.create(db, { ...body, ...{ plan_id: planId } });

      return res.status(200).json(pasture).end();
    } catch (err) {
      logger.error(`PlanPastureController:store: fail with error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Update plan's pasture
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async update(req, res) {
    const { params, body, user } = req;
    const { planId: canonicalId, pastureId } = params;

    checkRequiredFields(
      ['planId', 'pastureId'], 'params', req,
    );

    try {
      const currentPlan = await Plan.findCurrentVersion(db, canonicalId);

      if (!currentPlan) {
        throw errorWithCode('Plan doesn\'t exist', 404);
      }

      const planId = currentPlan.id;

      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      // Use the planId from the URL so that we know exactly what plan
      // is being updated and to ensure its not reassigned.
      delete body.planId;
      delete body.plan_id;

      const updatedPasture = await Pasture.update(
        db,
        { canonical_id: pastureId, plan_id: planId },
        { ...body, plan_id: planId },
      );

      return res.status(200).json(updatedPasture).end();
    } catch (err) {
      logger.error(`PlanPastureController: update: fail with error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Create plant community
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async storePlatCommunity(req, res) {
    const { params, body, user } = req;
    const { planId, pastureId } = params;

    checkRequiredFields(
      ['planId', 'pastureId'], 'params', req,
    );

    checkRequiredFields(
      ['communityTypeId', 'purposeOfAction'], 'body', req,
    );

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const pasture = await Pasture.findOne(db, { id: pastureId });
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const { purposeOfAction } = body;
      if (!PURPOSE_OF_ACTION.includes(purposeOfAction)) {
        throw errorWithCode(`Unacceptable purpose of action with "${purposeOfAction}"`);
      }
      const plantCommunity = await PlantCommunity.create(db, { ...body, pastureId });
      return res.status(200).json(plantCommunity).end();
    } catch (error) {
      logger.error(`PlanPastureController: storePlatCommunity: fail with error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store Action for Plant community of plan.
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async storePlantCommunityAction(req, res) {
    const { params, body, user } = req;
    const { planId, pastureId, communityId } = params;

    checkRequiredFields(
      ['planId', 'pastureId', 'communityId'], 'params', req,
    );

    checkRequiredFields(
      ['actionTypeId'], 'body', req,
    );

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const pasture = await Pasture.findOne(db, { id: pastureId });
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const plantCommunity = await PlantCommunity.findOne(db, { id: communityId });
      if (!plantCommunity) {
        throw errorWithCode(`No plant community found with id: ${communityId}`);
      }
      const plantCommunityAction = await PlantCommunityAction.create(
        db,
        {
          ...body,
          plantCommunityId: communityId,
        },
      );
      return res.status(200).json(plantCommunityAction).end();
    } catch (error) {
      logger.error(`PlanPastureController: storePlantCommunityAction: fail with error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create Indicator plant
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async storeIndicatorPlant(req, res) {
    const { params, body, user } = req;
    const { planId, pastureId, communityId } = params;
    const { criteria } = body;

    checkRequiredFields(
      ['planId', 'pastureId', 'communityId'], 'params', req,
    );

    checkRequiredFields(
      ['criteria'], 'body', req,
    );

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      if (!PLANT_COMMUNITY_CRITERIA.includes(criteria)) {
        throw errorWithCode(`Unacceptable plant community criteria with "${criteria}"`);
      }

      const pasture = await Pasture.findOne(db, { id: pastureId });
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const plantCommunity = await PlantCommunity.findOne(db, { id: communityId });
      if (!plantCommunity) {
        throw errorWithCode(`No plant community found with id: ${communityId}`);
      }

      const indicatorPlant = await IndicatorPlant.create(
        db,
        {
          ...body,
          plantCommunityId: communityId,
        },
      );
      return res.status(200).json(indicatorPlant).end();
    } catch (error) {
      logger.error(`PlanPastureController: storeIndicatorPlant: fail with error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store monitoring area for plant community
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async storeMonitoringArea(req, res) {
    const { params, body, user } = req;
    const { planId, pastureId, communityId } = params;
    const { purposeTypeIds } = body;

    checkRequiredFields(
      ['planId', 'pastureId', 'communityId'], 'params', req,
    );

    checkRequiredFields(
      ['name', 'purposeTypeIds'], 'body', req,
    );

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const pasture = await Pasture.findOne(db, { id: pastureId });
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const plantCommunity = await PlantCommunity.findOne(db, { id: communityId });
      if (!plantCommunity) {
        throw errorWithCode(`No plant community found with id: ${communityId}`);
      }

      const monitoringArea = await MonitoringArea.create(
        db,
        { ...body, plantCommunityId: communityId },
      );

      const promises = purposeTypeIds.map(pId => (
        MonitoringAreaPurpose.create(db, {
          monitoringAreaId: monitoringArea.id,
          purposeTypeId: pId,
        })
      ));
      await Promise.all(promises);
      await monitoringArea.fetchMonitoringAreaPurposes(
        db, { monitoring_area_id: monitoringArea.id },
      );

      return res.status(200).json(monitoringArea).end();
    } catch (error) {
      logger.error(`PlanPastureController: storeMonitoringArea: fail with error: ${error.message}`);
      throw error;
    }
  }
}
