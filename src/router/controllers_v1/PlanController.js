import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields, objPathToCamelCase } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';

const dm = new DataManager(config);
const {
  db,
  Plan,
  Agreement,
  PlanConfirmation,
  PlanStatus,
  AdditionalRequirement,
} = dm;

export default class PlanController {
  // --
  // Plan Resource / Doc / Table CRUD Operation
  // --
  /**
   * Display plan
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async show(req, res) {
    const { user, params } = req;
    const { planId } = params;

    checkRequiredFields(
      ['planId'], 'params', req,
    );

    try {
      const [plan] = await Plan.findWithStatusExtension(db, { 'plan.id': planId }, ['id', 'desc']);
      if (!plan) {
        throw errorWithCode('Plan doesn\'t exist', 404);
      }
      const { agreementId } = plan;
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(
        db, { forest_file_id: agreementId },
      );
      await agreement.eagerloadAllOneToManyExceptPlan();
      agreement.transformToV1();

      await plan.eagerloadAllOneToMany();
      plan.agreement = agreement;

      const mappedGrazingSchedules = await Promise.all(
        plan.grazingSchedules.map(async schedule => ({
          ...schedule,
          sortBy: schedule.sortBy && objPathToCamelCase(schedule.sortBy),
        })),
      );

      return res.status(200).json({
        ...plan,
        grazingSchedules: mappedGrazingSchedules,
      }).end();
    } catch (error) {
      logger.error(`Unable to fetch plan, error: ${error.message}`);
      throw errorWithCode(`There was a problem fetching the record. Error: ${error.message}`, error.code || 500);
    }
  }

  /**
   * Create Plan
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async store(req, res) {
    const { body, user } = req;
    const { agreementId } = body;
    checkRequiredFields(
      ['statusId'], 'body', req,
    );

    try {
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const agreement = await Agreement.findById(db, agreementId);
      if (!agreement) {
        throw errorWithCode('agreement not found', 404);
      }

      if (body.id || body.planId) {
        const plan = await Plan.findById(db, body.id || body.planId);
        if (plan) {
          throw errorWithCode('A plan with this ID exists. Use PUT.', 409);
        }
      }

      // delete the old plan whose status is 'Staff Draft'
      const staffDraftStatus = await PlanStatus.findOne(db, {
        code: 'SD',
      });
      await Plan.remove(db, {
        agreement_id: agreement.id,
        status_id: staffDraftStatus.id,
      });

      const plan = await Plan.create(db, { ...body, creator_id: user.id });

      // create unsiged confirmations for AHs
      await PlanConfirmation.createConfirmations(db, agreementId, plan.id);

      return res.status(200).json(plan).end();
    } catch (err) {
      throw err;
    }
  }

  /**
   * Update Plan
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async update(req, res) {
    const { params, body, user } = req;
    const { planId } = params;

    checkRequiredFields(
      ['planId'], 'params', req,
    );

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      // Don't allow the agreement relation to be updated.
      delete body.agreementId;

      await Plan.update(db, { id: planId }, body);
      const [plan] = await Plan.findWithStatusExtension(db, { 'plan.id': planId }, ['id', 'desc']);
      await plan.eagerloadAllOneToMany();

      const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(
        db, { forest_file_id: agreementId },
      );
      await agreement.eagerloadAllOneToManyExceptPlan();
      agreement.transformToV1();
      plan.agreement = agreement;

      return res.status(200).json(plan).end();
    } catch (err) {
      throw err;
    }
  }

  // --
  // Plan Operation based on plan
  // --

  // --
  // Additional requirement
  /**
   * Create Additional requirement
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async storeAdditionalRequirement(req, res) {
    const { body, params, user } = req;
    const { planId } = params;

    checkRequiredFields(
      ['planId'], 'params', req,
    );

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
      const requirement = await AdditionalRequirement.create(db, { ...body, plan_id: planId });
      return res.status(200).json(requirement).end();
    } catch (error) {
      throw error;
    }
  }

  static async updateAdditionalRequirement(req, res) {
    const { body, params, user } = req;
    const { planId, requirementId } = params;

    checkRequiredFields(['planId', 'requirementId'], 'params', req);

    const agreementId = await Plan.agreementForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(
      db,
      Agreement,
      user,
      agreementId,
    );

    delete body.id;
    delete body.planId;
    delete body.plan_id;

    const requirement = await AdditionalRequirement.findOne(db, {
      requirement_id: requirementId,
    });

    if (!requirement) {
      throw errorWithCode("Additional requirement doesn't exist", 404);
    }

    const updatedRequirement = await AdditionalRequirement.update(
      db,
      {
        id: requirement.id,
      },
      body,
    );

    res.send(updatedRequirement);
  }

  static async destroyAdditionalRequirement(req, res) {
    const { body, params, user } = req;
    const { planId, requirementId } = params;

    checkRequiredFields(['planId', 'requirementId'], 'params', req);

    const agreementId = await Plan.agreementForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(
      db,
      Agreement,
      user,
      agreementId,
    );

    delete body.id;
    delete body.planId;
    delete body.plan_id;

    const result = await AdditionalRequirement.remove(
      db,
      {
        id: requirementId,
      },
    );

    if (result === 0) {
      throw errorWithCode('Could not find additional requirement', 400);
    }

    res.status(204).end();
  }
}
