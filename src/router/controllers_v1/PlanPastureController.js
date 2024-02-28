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
    const {
      params: { planId },
      body,
      user,
    } = req;

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      // Use the planId from the URL so that we know exactly what plan
      // is being updated.
      delete body.planId;
      delete body.plan_id;

      const pasture = await Pasture.create(db, { ...body, plan_id: planId });

      return res.status(200).json(pasture).end();
    } catch (err) {
      logger.error(
        `PlanPastureController:store: fail with error: ${err.message}`,
      );
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
    const { planId, pastureId } = params;

    checkRequiredFields(['planId', 'pastureId'], 'params', req);

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      // Use the planId from the URL so that we know exactly what plan
      // is being updated and to ensure its not reassigned.
      delete body.planId;
      delete body.plan_id;

      const pasture = await Pasture.update(
        db,
        { id: pastureId },
        { ...body, plan_id: planId },
      );

      return res.status(200).json(pasture).end();
    } catch (err) {
      logger.error(
        `PlanPastureController: update: fail with error: ${err.message}`,
      );
      throw err;
    }
  }

  /**
   * Delete a pasture
   * @param {*} req - express req
   * @param {*} res - express res
   */
  static async destroy(req, res) {
    const { params, user } = req;
    const { planId, pastureId } = params;

    checkRequiredFields(['planId', 'pastureId'], 'params', req);

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      const result = await Pasture.remove(db, { id: pastureId });

      if (result === 0) {
        throw errorWithCode("Pasture doesn't exist", 400);
      }

      return res.status(204).send();
    } catch (err) {
      logger.error(
        `PlanPastureController: update: fail with error: ${err.message}`,
      );
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

    checkRequiredFields(['planId', 'pastureId'], 'params', req);

    checkRequiredFields(['communityTypeId', 'purposeOfAction'], 'body', req);

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      const pasture = await Pasture.findOne(db, { id: pastureId });
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }

      const { purposeOfAction } = body;
      if (!PURPOSE_OF_ACTION.includes(purposeOfAction)) {
        throw errorWithCode(
          `Unacceptable purpose of action with "${purposeOfAction}"`,
        );
      }

      const plantCommunity = await PlantCommunity.create(db, {
        ...body,
        pastureId,
      });

      return res.status(200).json(plantCommunity).end();
    } catch (error) {
      logger.error(
        `PlanPastureController: storePlatCommunity: fail with error: ${error.message}`,
      );
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
    const { planId, pastureId, communityId } = params;

    checkRequiredFields(['planId', 'pastureId', 'communityId'], 'params', req);

    const agreementId = await Plan.agreementIdForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(
      db,
      Agreement,
      user,
      agreementId,
    );

    const pasture = await Pasture.findOne(db, { id: pastureId });

    if (!pasture) {
      throw errorWithCode("Pasture doesn't exist", 404);
    }

    const plantCommunity = await PlantCommunity.findById(db, communityId);

    if (!plantCommunity) {
      throw errorWithCode("Plant community doesn't exist", 404);
    }

    const updatedPlantCommunity = await PlantCommunity.update(
      db,
      { id: communityId },
      { ...body, plan_id: planId, pasture_id: pasture.id, id: communityId },
    );

    return res.json(updatedPlantCommunity).end();
  }

  static async destroyPlantCommunity(req, res) {
    const { params, user } = req;
    const { planId, pastureId, communityId } = params;

    checkRequiredFields(['planId', 'pastureId', 'communityId'], 'params', req);

    const agreementId = await Plan.agreementIdForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(
      db,
      Agreement,
      user,
      agreementId,
    );

    const pasture = await Pasture.findById(db, pastureId);

    if (!pasture) {
      throw errorWithCode("Pasture doesn't exist", 404);
    }

    const result = await PlantCommunity.remove(db, {
      id: communityId,
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

    checkRequiredFields(['planId', 'pastureId', 'communityId'], 'params', req);

    checkRequiredFields(['actionTypeId'], 'body', req);

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      const pasture = await Pasture.findById(db, pastureId);
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const plantCommunity = await PlantCommunity.findById(db, communityId);
      if (!plantCommunity) {
        throw errorWithCode(`No plant community found with id: ${communityId}`);
      }
      const plantCommunityAction = await PlantCommunityAction.create(db, {
        ...body,
        plantCommunityId: communityId,
      });
      return res.status(200).json(plantCommunityAction).end();
    } catch (error) {
      logger.error(
        `PlanPastureController: storePlantCommunityAction: fail with error: ${error.message}`,
      );
      throw error;
    }
  }

  static async updatePlantCommunityAction(req, res) {
    const { params, body, user } = req;
    const { planId, pastureId, communityId, actionId } = params;

    checkRequiredFields(
      ['planId', 'pastureId', 'communityId', 'actionId'],
      'params',
      req,
    );

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      const pasture = await Pasture.findById(db, pastureId);
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const plantCommunity = await PlantCommunity.findById(db, communityId);
      if (!plantCommunity) {
        throw errorWithCode(`No plant community found with id: ${communityId}`);
      }

      const action = await PlantCommunityAction.findById(db, actionId);

      if (!action) {
        throw errorWithCode('Could not find plant community action', 404);
      }

      const updatedAction = await PlantCommunityAction.update(
        db,
        { id: actionId },
        body,
      );
      return res.status(200).json(updatedAction).end();
    } catch (error) {
      logger.error(
        `PlanPastureController: storePlantCommunityAction: fail with error: ${error.message}`,
      );
      throw error;
    }
  }

  static async destroyPlantCommunityAction(req, res) {
    const { params, user } = req;
    const { planId, pastureId, communityId, actionId } = params;

    checkRequiredFields(
      ['planId', 'pastureId', 'communityId', 'actionId'],
      'params',
      req,
    );

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      const pasture = await Pasture.findById(db, pastureId);
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const plantCommunity = await PlantCommunity.findById(db, communityId);
      if (!plantCommunity) {
        throw errorWithCode(`No plant community found with id: ${communityId}`);
      }

      const result = await PlantCommunityAction.removeById(db, actionId);

      if (result === 0) {
        throw errorWithCode('Could not find plant community action', 400);
      }

      return res.status(204).end();
    } catch (error) {
      logger.error(
        `PlanPastureController: storePlantCommunityAction: fail with error: ${error.message}`,
      );
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

    checkRequiredFields(['planId', 'pastureId', 'communityId'], 'params', req);

    checkRequiredFields(['criteria'], 'body', req);

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      if (!PLANT_COMMUNITY_CRITERIA.includes(criteria)) {
        throw errorWithCode(
          `Unacceptable plant community criteria with "${criteria}"`,
        );
      }

      const pasture = await Pasture.findById(db, pastureId);
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const plantCommunity = await PlantCommunity.findById(db, communityId);
      if (!plantCommunity) {
        throw errorWithCode(`No plant community found with id: ${communityId}`);
      }

      const indicatorPlant = await IndicatorPlant.create(db, {
        ...body,
        plantCommunityId: plantCommunity.id,
      });
      return res.status(200).json(indicatorPlant).end();
    } catch (error) {
      logger.error(
        `PlanPastureController: storeIndicatorPlant: fail with error: ${error.message}`,
      );
      throw error;
    }
  }

  static async updateIndicatorPlant(req, res) {
    const { params, body, user } = req;
    const { planId, pastureId, communityId, plantId } = params;
    const { criteria } = body;

    checkRequiredFields(
      ['planId', 'pastureId', 'communityId', 'plantId'],
      'params',
      req,
    );

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      if (criteria && !PLANT_COMMUNITY_CRITERIA.includes(criteria)) {
        throw errorWithCode(
          `Unacceptable plant community criteria with "${criteria}"`,
        );
      }

      const pasture = await Pasture.findById(db, pastureId);
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const plantCommunity = await PlantCommunity.findById(db, communityId);
      if (!plantCommunity) {
        throw errorWithCode(`No plant community found with id: ${communityId}`);
      }

      const indicatorPlant = await IndicatorPlant.findById(db, plantId);

      if (!indicatorPlant) {
        throw errorWithCode('Could not find indicator plant', 404);
      }

      const updatedIndicatorPlant = await IndicatorPlant.update(
        db,
        { id: plantId },
        body,
      );
      return res.status(200).json(updatedIndicatorPlant).end();
    } catch (error) {
      logger.error(
        `PlanPastureController: storeIndicatorPlant: fail with error: ${error.message}`,
      );
      throw error;
    }
  }

  static async destroyIndicatorPlant(req, res) {
    const { params, user } = req;
    const { planId, pastureId, communityId, plantId } = params;

    checkRequiredFields(
      ['planId', 'pastureId', 'communityId', 'plantId'],
      'params',
      req,
    );

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      const pasture = await Pasture.findById(db, pastureId);
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const plantCommunity = await PlantCommunity.findById(db, communityId);
      if (!plantCommunity) {
        throw errorWithCode(`No plant community found with id: ${communityId}`);
      }

      const result = await IndicatorPlant.removeById(db, plantId);

      if (result === 0) {
        throw errorWithCode('Could not find indicator plant', 400);
      }

      return res.status(204).end();
    } catch (error) {
      logger.error(
        `PlanPastureController: storeIndicatorPlant: fail with error: ${error.message}`,
      );
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

    checkRequiredFields(['planId', 'pastureId', 'communityId'], 'params', req);

    checkRequiredFields(['name', 'purposeTypeIds'], 'body', req);

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      const pasture = await Pasture.findById(db, pastureId);
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const plantCommunity = await PlantCommunity.findById(db, communityId);
      if (!plantCommunity) {
        throw errorWithCode(`No plant community found with id: ${communityId}`);
      }

      const monitoringArea = await MonitoringArea.create(db, {
        ...body,
        plantCommunityId: communityId,
      });

      const promises = purposeTypeIds.map((pId) =>
        MonitoringAreaPurpose.create(db, {
          monitoringAreaId: monitoringArea.id,
          purposeTypeId: pId,
        }),
      );
      await Promise.all(promises);
      await monitoringArea.fetchMonitoringAreaPurposes(db, {
        monitoring_area_id: monitoringArea.id,
      });

      return res.status(200).json(monitoringArea).end();
    } catch (error) {
      logger.error(
        `PlanPastureController: storeMonitoringArea: fail with error: ${error.message}`,
      );
      throw error;
    }
  }

  static async updateMonitoringArea(req, res) {
    const { params, body, user } = req;
    const { planId, pastureId, communityId, areaId } = params;
    const { purposeTypeIds = [], ...bodyData } = body;

    checkRequiredFields(
      ['planId', 'pastureId', 'communityId', 'areaId'],
      'params',
      req,
    );

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      const pasture = await Pasture.findById(db, pastureId);
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const plantCommunity = await PlantCommunity.findById(db, communityId);
      if (!plantCommunity) {
        throw errorWithCode(`No plant community found with id: ${communityId}`);
      }

      const monitoringArea = await MonitoringArea.findById(db, areaId);

      if (!monitoringArea) {
        throw errorWithCode('Monitoring area not found', 404);
      }

      await monitoringArea.fetchMonitoringAreaPurposes(db, {
        monitoring_area_id: monitoringArea.id,
      });

      // Delete purposes not included in updated purposeTypeIds array
      await Promise.all(
        monitoringArea.purposes.map((purpose) => {
          if (!purposeTypeIds.includes(purpose.purposeTypeId)) {
            return MonitoringAreaPurpose.remove(db, {
              monitoring_area_id: monitoringArea.id,
              id: purpose.id,
            });
          }

          return Promise.resolve();
        }),
      );

      // Create any purposes that don't exist yet
      const promises = purposeTypeIds.map((pId) => {
        const existingPurpose = monitoringArea.purposes.find(
          (p) => p.purposeTypeId === pId,
        );

        if (!existingPurpose) {
          return MonitoringAreaPurpose.create(db, {
            monitoringAreaId: monitoringArea.id,
            purposeTypeId: pId,
          });
        }
        return existingPurpose;
      });

      // Format the purposes for the client
      const purposes = await Promise.all(promises);

      // Skip update if the body is empty
      const updatedMonitoringArea =
        Object.entries(bodyData).length !== 0
          ? await MonitoringArea.update(db, { id: monitoringArea.id }, bodyData)
          : monitoringArea;

      return res
        .status(200)
        .json({ ...updatedMonitoringArea, purposes })
        .end();
    } catch (error) {
      logger.error(
        `PlanPastureController: storeMonitoringArea: fail with error: ${error.message}`,
      );
      throw error;
    }
  }

  static async destroyMonitoringArea(req, res) {
    const { params, user } = req;
    const { planId, pastureId, communityId, areaId } = params;

    checkRequiredFields(
      ['planId', 'pastureId', 'communityId', 'areaId'],
      'params',
      req,
    );

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );

      const pasture = await Pasture.findById(db, pastureId);
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const plantCommunity = await PlantCommunity.findById(db, communityId);
      if (!plantCommunity) {
        throw errorWithCode(`No plant community found with id: ${communityId}`);
      }

      const monitoringArea = await MonitoringArea.findById(db, areaId);

      if (!monitoringArea) {
        throw errorWithCode('Monitoring area not found', 400);
      }

      await monitoringArea.fetchMonitoringAreaPurposes(db, {
        monitoring_area_id: areaId,
      });

      // Remove monitoring area purposes
      await Promise.all(
        monitoringArea.purposes.map((purpose) =>
          MonitoringAreaPurpose.remove(db, {
            monitoring_area_id: monitoringArea.id,
            id: purpose.id,
          }),
        ),
      );

      await MonitoringArea.remove(db, { id: monitoringArea.id });

      return res.status(204).end();
    } catch (error) {
      logger.error(
        `PlanPastureController: storeMonitoringArea: fail with error: ${error.message}`,
      );
      throw error;
    }
  }
}
