import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields, objPathToCamelCase } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';


export default class NotificationController {
  // --
  // Notification Resource / Doc / Table CRUD Operation
  // --
  /**
   * Display plan
   * @param {*} req : express req object
   * @param {*} res : express resp object
   */
  static async show(req, res) {
    const { user } = req;


    try {
      //const isStaff = user.isAdministrator() || user.isRangeOfficer() || user.isDecisionMaker();


        return res.status(200).json({
          notifications: { examples: [1,2,3]},
        }).end();

    } catch (error) {
      logger.error(`Unable to fetch notifications, error: ${error.message}`);
      throw errorWithCode(`There was a problem fetching the record. Error: ${error.message}`, error.code || 500);
    }
  }

  /**
   * Create Notification
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
      await NotificationRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const agreement = await Agreement.findById(db, agreementId);
      if (!agreement) {
        throw errorWithCode('agreement not found', 404);
      }

      if (body.id || body.planId) {
        const plan = await Notification.findById(db, body.id || body.planId);
        if (plan) {
          throw errorWithCode('A plan with this ID exists. Use PUT.', 409);
        }
      }

      // delete the old plan whose status is 'Staff Draft'
      const staffDraftStatus = await NotificationStatus.findOne(db, {
        code: 'SD',
      });
      await Notification.remove(db, {
        agreement_id: agreement.id,
        status_id: staffDraftStatus.id,
      });

      const plan = await Notification.create(db, { ...body, creator_id: user.id });

      // create unsiged confirmations for AHs
      await NotificationConfirmation.createConfirmations(db, agreementId, plan.id);

      return res.status(200).json(plan).end();
    } catch (err) {
      throw err;
    }
  }

  /**
   * Update Notification
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
      const agreementId = await Notification.agreementForNotificationId(db, planId);
      await NotificationRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      // Don't allow the agreement relation to be updated.
      delete body.agreementId;

      await Notification.update(db, { id: planId }, body);
      const [plan] = await Notification.findWithStatusExtension(db, { 'plan.id': planId }, ['id', 'desc']);
      await plan.eagerloadAllOneToMany();

      const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(
        db, { forest_file_id: agreementId },
      );
      await agreement.eagerloadAllOneToManyExceptNotification();
      agreement.transformToV1();
      plan.agreement = agreement;

      return res.status(200).json(plan).end();
    } catch (err) {
      throw err;
    }
  }

  // --
  // Notification Operation based on plan
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
      const agreementId = await Notification.agreementForNotificationId(db, planId);
      await NotificationRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
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

    const agreementId = await Notification.agreementForNotificationId(db, planId);
    await NotificationRouteHelper.canUserAccessThisAgreement(
      db,
      Agreement,
      user,
      agreementId,
    );

    delete body.id;
    delete body.planId;
    delete body.plan_id;

    const requirement = await AdditionalRequirement.findOne(db, {
      id: requirementId,
    });

    if (!requirement) {
      throw errorWithCode("Additional requirement doesn't exist", 404);
    }

    const updatedRequirement = await AdditionalRequirement.update(
      db,
      {
        id: requirementId,
      },
      body,
    );

    res.send(updatedRequirement);
  }

  static async destroyAdditionalRequirement(req, res) {
    const { body, params, user } = req;
    const { planId, requirementId } = params;

    checkRequiredFields(['planId', 'requirementId'], 'params', req);

    const agreementId = await Notification.agreementForNotificationId(db, planId);
    await NotificationRouteHelper.canUserAccessThisAgreement(
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

  static async discardAmendment(req, res) {
    const { params, user } = req;
    const { planId } = params;

    checkRequiredFields(['planId'], 'params', req);

    const plan = await Notification.findById(db, planId);
    if (!plan) {
      throw errorWithCode('Could not find plan', 404);
    }

    if (Notification.isLegal(plan) || !Notification.isAmendment(plan)) {
      throw errorWithCode('This plan is not an amendment, and cannot be discarded.', 400);
    }

    const agreementId = await Notification.agreementForNotificationId(db, planId);
    await NotificationRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

    const prevLegalVersion = await db
      .table('plan_snapshot_summary')
      .whereIn('status_id', Notification.legalStatuses)
      .andWhere({
        plan_id: planId,
      })
      .orderBy('created_at', 'desc')
      .first();

    if (!prevLegalVersion) {
      throw errorWithCode('Could not find previous legal version.', 500);
    }

    logger.info(`Restoring snapshot ID ${prevLegalVersion.id} for plan ${planId}`);

    await Notification.restoreVersion(db, planId, prevLegalVersion.version);

    const versionsToDiscard = await db
      .table('plan_snapshot_summary')
      .select('id')
      .where({ plan_id: planId })
      .andWhereRaw('created_at > ?::timestamp', [prevLegalVersion.created_at.toISOString()]);

    const versionIdsToDiscard = versionsToDiscard.map(v => v.id);

    logger.info(`Marking as discarded: ${JSON.stringify(versionIdsToDiscard)}`);

    await db
      .table('plan_snapshot')
      .update({ is_discarded: true })
      .whereIn('id', versionIdsToDiscard);

    res.status(200).end();
  }

  static async storeAttachment(req, res) {
    const { params, user, body } = req;
    const { planId } = params;

    if (!user || !user.isRangeOfficer()) {
      throw errorWithCode('Unauthorized', 403);
    }

    const agreementId = await Notification.agreementForNotificationId(db, planId);

    await NotificationRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

    const planFile = await NotificationFile.create(db, {
      name: body.name,
      url: body.url,
      type: body.type,
      access: body.access ?? 'staff_only',
      plan_id: planId,
      user_id: user.id,
    });

    res.json(planFile).end();
  }

  static async updateAttachment(req, res) {
    const { params, user, body } = req;
    const { planId, attachmentId } = params;

    if (!user || !user.isRangeOfficer()) {
      throw errorWithCode('Unauthorized', 403);
    }

    const agreementId = await Notification.agreementForNotificationId(db, planId);

    await NotificationRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
    const planFile = await NotificationFile.findById(db, attachmentId);
    if (!planFile) {
      throw errorWithCode('Could not find file', 404);
    }

    const newNotificationFile = await NotificationFile.update(db, { id: attachmentId }, {
      access: body.access ?? 'staff_only',
    });

    res.json(newNotificationFile).end();
  }

  static async removeAttachment(req, res) {
    const { params, user } = req;
    const { planId, attachmentId } = params;

    if (!user || !user.isRangeOfficer()) {
      throw errorWithCode('Unauthorized', 403);
    }

    const agreementId = await Notification.agreementForNotificationId(db, planId);
    await NotificationRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

    const result = await NotificationFile.removeById(db, attachmentId);

    if (result === 0) {
      throw errorWithCode('Could not find attachment', 400);
    }

    res.status(204).end();
  }
}
