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
    const { params: { planId: canonicalId }, body, user } = req;

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

      // Use the planId from the URL so that we know exactly what plan
      // is being updated.
      delete body.planId;
      delete body.plan_id;

      const { canonicalId: pastureCanonicalId, ...pasture } = await Pasture.create(db, { ...body, plan_id: planId });

      return res.status(200).json({ ...pasture, id: pastureCanonicalId }).end();
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

      const { canonicalId: pastureCanonicalId, ...updatedPasture } = await Pasture.update(
        db,
        { canonical_id: pastureId, plan_id: planId },
        { ...body, plan_id: planId },
      );

      return res.status(200).json({ ...updatedPasture, id: pastureCanonicalId }).end();
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
      const { canonicalId: communityCanonicalId, ...plantCommunity } = await PlantCommunity.create(db, { ...body, pastureId });
      return res.status(200).json({ ...plantCommunity, id: communityCanonicalId }).end();
    } catch (error) {
      logger.error(`PlanPastureController: storePlatCommunity: fail with error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a plant community
   * @param {*} req : express req
   * @param {*} res : express res
   */

  static async updatePlantCommunity(req, res) {
    const { params, body, user } = req;
    const { planId: canonicalId, pastureId, communityId } = params;

    checkRequiredFields(
      ['planId', 'pastureId', 'communityId'], 'params', req,
    );

    const currentPlan = await Plan.findCurrentVersion(db, canonicalId);

    if (!currentPlan) {
      throw errorWithCode('Plan doesn\'t exist', 404);
    }

    const planId = currentPlan.id;

    const agreementId = await Plan.agreementForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

    const pasture = await Pasture.findOne(db, { plan_id: planId, canonical_id: pastureId });

    if (!pasture) {
      throw errorWithCode("Pasture doesn't exist", 404);
    }

    const plantCommunity = await PlantCommunity.findOne(db, {
      canonical_id: communityId,
      pasture_id: pasture.id,
    });

    if (!plantCommunity) {
      throw errorWithCode("Plant community doesn't exist", 404);
    }

    const { canonicalId: communityCanonicalId, ...updatedPlantCommunity } = await PlantCommunity.update(
      db,
      { id: plantCommunity.id },
      { ...body, plan_id: planId, pasture_id: pasture.id, canonical_id: communityId },
    );

    return res.json({ ...updatedPlantCommunity, id: communityCanonicalId }).end();
  }

  static async destroyPlantCommunity(req, res) {
    const { params, user } = req;
    const { planId: canonicalId, pastureId, communityId } = params;

    checkRequiredFields(
      ['planId', 'pastureId', 'communityId'], 'params', req,
    );

    const currentPlan = await Plan.findCurrentVersion(db, canonicalId);

    if (!currentPlan) {
      throw errorWithCode('Plan doesn\'t exist', 404);
    }

    const planId = currentPlan.id;

    const agreementId = await Plan.agreementForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

    const pasture = await Pasture.findOne(db, { plan_id: planId, canonical_id: pastureId });

    if (!pasture) {
      throw errorWithCode("Pasture doesn't exist", 404);
    }

    const result = await PlantCommunity.remove(db, {
      canonical_id: communityId,
      pasture_id: pasture.id,
    });

    if (result === 0) {
      throw errorWithCode("Plant community doesn't exist", 400);
    }

    return res.status(204).send();
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
      const { canonicalId: actionCanonicalId, ...plantCommunityAction } = await PlantCommunityAction.create(
        db,
        {
          ...body,
          plantCommunityId: communityId,
        },
      );
      return res.status(200).json({ ...plantCommunityAction, id: actionCanonicalId }).end();
    } catch (error) {
      logger.error(`PlanPastureController: storePlantCommunityAction: fail with error: ${error.message}`);
      throw error;
    }
  }

  static async updatePlantCommunityAction(req, res) {
    const { params, body, user } = req;
    const { planId, pastureId, communityId, actionId } = params;

    checkRequiredFields(
      ['planId', 'pastureId', 'communityId', 'actionId'], 'params', req,
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

      const action = await PlantCommunityAction.findOne(
        db,
        { plant_community_id: communityId, canonical_id: actionId },
      );

      if (!action) {
        throw errorWithCode('Could not find plant community action', 404);
      }

      const { canonicalId: actionCanonicalId, ...updatedAction } = await PlantCommunityAction.update(
        db,
        { id: action.id },
        body,
      );
      return res.status(200).json({ ...updatedAction, id: actionCanonicalId }).end();
    } catch (error) {
      logger.error(`PlanPastureController: storePlantCommunityAction: fail with error: ${error.message}`);
      throw error;
    }
  }

  static async destroyPlantCommunityAction(req, res) {
    const { params, user } = req;
    const { planId, pastureId, communityId, actionId } = params;

    checkRequiredFields(
      ['planId', 'pastureId', 'communityId', 'actionId'], 'params', req,
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

      const result = await PlantCommunityAction.remove(
        db,
        { plant_community_id: communityId, canonical_id: actionId },
      );

      if (result === 0) {
        throw errorWithCode('Could not find plant community action', 400);
      }

      return res.status(204).end();
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

      const { canonicalId: plantCanonicalId, ...indicatorPlant } = await IndicatorPlant.create(
        db,
        {
          ...body,
          plantCommunityId: communityId,
        },
      );
      return res.status(200).json({ ...indicatorPlant, id: plantCanonicalId }).end();
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

      const purposes = monitoringArea.purposes.map(({ canonicalId: purposeCanonicalId, ...purpose }) => ({
        ...purpose,
        id: purposeCanonicalId,
      }));

      const { canonicalId: areaCanonicalId, ...newMonitoringArea } = monitoringArea;

      return res.status(200).json({ ...newMonitoringArea, id: areaCanonicalId, purposes }).end();
    } catch (error) {
      logger.error(`PlanPastureController: storeMonitoringArea: fail with error: ${error.message}`);
      throw error;
    }
  }
}
