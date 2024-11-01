import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { isNumeric, checkRequiredFields, substituteFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PLAN_STATUS } from '../../constants';
import { PlanRouteHelper } from '../helpers';
import PlanSnapshot from '../../libs/db2/model/plansnapshot';
import { Mailer } from '../../libs/mailer';
import Client from '../../libs/db2/model/client';
import User from '../../libs/db2/model/user';
import EmailTemplate from '../../libs/db2/model/emailtemplate';
import Zone from '../../libs/db2/model/zone';
import PlanController from './PlanController';

const dm = new DataManager(config);
const { db, Plan, PlanConfirmation, PlanStatusHistory, PlanStatus, Agreement } = dm;

export default class PlanStatusController {
  // -------  Helper methods  -------
  /**
   * Update Plan status
   * @param {*} planId : string
   * @param {*} status : object
   * @param {*} user : Models/User
   */
  static async updatePlanStatus(planId, status = {}, user) {
    try {
      // const plan = await Plan.findOne(db, { id: planId });
      const body = { status_id: status.id };
      switch (status.code) {
        case PLAN_STATUS.APPROVED:
          body.effective_at = new Date();
          break;
        case PLAN_STATUS.STANDS:
          body.effective_at = new Date();
          body.submitted_at = new Date();
          break;
        case PLAN_STATUS.WRONGLY_MADE_WITHOUT_EFFECT:
          body.effective_at = null;
          break;
        case PLAN_STATUS.SUBMITTED_FOR_FINAL_DECISION:
        case PLAN_STATUS.SUBMITTED_FOR_REVIEW:
          body.submitted_at = new Date();
          break;
        case PLAN_STATUS.AWAITING_CONFIRMATION:
          // refresh all the old confirmations and start fresh
          await PlanConfirmation.refreshConfirmations(db, planId, user);
          break;
        default:
          break;
      }

      // Don't create a snapshot if the plan we're updating the status for
      // already has a legal status
      const originalPlan = await Plan.findById(db, planId);
      if (!originalPlan.isRestored && !Plan.isLegal(originalPlan)) {
        await Plan.createSnapshot(db, planId, user);
      }

      const updatedPlan = await Plan.update(db, { id: planId }, { ...body, is_restored: false });

      // If the new status was legal, create a snapshot after updating
      if (
        (!originalPlan.isRestored && Plan.isLegal(updatedPlan)) ||
        status.code === PLAN_STATUS.WRONGLY_MADE_WITHOUT_EFFECT ||
        status.code === PLAN_STATUS.NOT_APPROVED
      ) {
        await Plan.createSnapshot(db, planId, user);
      }

      if (status.code === PLAN_STATUS.WRONGLY_MADE_WITHOUT_EFFECT) {
        /*
         *  The previous legal version should always be right before the "stands"
         *  version for the minor amendment that was just determined to be
         *  wrongly made without effect.
         */
        const prevLegal = PlanStatusController.getLatestLegalVersion(planId);
        const {
          rows: [{ max: lastVersion }],
        } = await db.raw(
          `
          SELECT MAX(version) FROM plan_snapshot
          WHERE plan_id = ?
        `,
          [planId],
        );

        await PlanSnapshot.create(
          db,
          {
            snapshot: prevLegal.snapshot,
            plan_id: planId,
            version: lastVersion + 1,
            created_at: new Date(),
            status_id: prevLegal.status_id,
            user_id: user.id,
          },
          user,
        );
      }

      if (status.code === PLAN_STATUS.NOT_APPROVED) {
        const prevLegal = PlanStatusController.getLatestLegalVersion(planId);
        const {
          rows: [{ max: lastVersion }],
        } = await db.raw(
          `
          SELECT MAX(version) FROM plan_snapshot
          WHERE plan_id = ?
        `,
          [planId],
        );

        await PlanSnapshot.create(
          db,
          {
            snapshot: prevLegal.snapshot,
            plan_id: planId,
            version: lastVersion + 1,
            created_at: new Date(),
            status_id: prevLegal.status_id,
            user_id: user.id,
          },
          user,
        );
      }

      return updatedPlan;
    } catch (err) {
      logger.error(`Error: Unable to update plan: ${err.message}`);
      throw err;
    }
  }

  // ----- Router Methods ------
  /**
   * Update Plan status
   *
   * @param {*} req : express req
   * @param {*} res : express resp
   */
  static async update(req, res) {
    const { params, body, user } = req;
    const { statusId, note } = body;
    const { planId } = params;

    checkRequiredFields(['planId'], 'params', req);
    checkRequiredFields(['statusId'], 'body', req);

    if (!isNumeric(statusId)) {
      throw errorWithCode('statusId must be numeric', 400);
    }

    try {
      const { agreement_id: agreementId, zone_id: zoneId } = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
      const planStatuses = await PlanStatus.find(db, { active: true });
      // make sure the status exists.
      const status = planStatuses.find((s) => s.id === statusId);
      if (!status) {
        throw errorWithCode('You must supply a valid status ID', 403);
      }
      const plan = await Plan.findById(db, planId);
      const zone = await Zone.findById(db, zoneId);
      const rangeOfficer = await User.findById(db, zone.userId);
      const { statusId: prevStatusId } = plan;
      await PlanStatusHistory.create(db, {
        fromPlanStatusId: prevStatusId,
        toPlanStatusId: statusId,
        note: note || ' ',
        planId,
        userId: user.id,
      });
      await PlanStatusController.updatePlanStatus(planId, status, user);
      const clients = await Client.clientsForAgreement(db, {
        forestFileId: agreementId,
      });
      const emails = [rangeOfficer.email];
      for (const client of clients) {
        const user = await User.fromClientId(db, client.clientNumber);
        if (user && user.email) {
          emails.push(user.email);
        }
      }
      const agents = await User.getAgentsFromAgreementId(db, agreementId);
      const agentEmails = [...new Set(agents.map((agent) => agent.email))];
      for (const agentEmail of agentEmails) {
        if (agentEmail && agentEmail.email) {
          emails.push(agentEmail.email);
        }
      }
      const toStatus = await PlanStatus.findById(db, statusId);
      const fromStatus = await PlanStatus.findById(db, prevStatusId);
      const templates = await EmailTemplate.findWithExclusion(db, {
        name: 'Plan Status Change',
      });
      const template = templates[0];
      const emailFields = {
        '{agreementId}': agreementId,
        '{fromStatus}': fromStatus.name,
        '{toStatus}': toStatus.name,
        '{rangeOfficerName}': `${rangeOfficer.givenName} ${rangeOfficer.familyName}`,
        '{rangeOfficerEmail}': rangeOfficer.email,
      };
      const mailer = new Mailer();
      mailer.sendEmail(
        emails,
        template.fromEmail,
        substituteFields(template.subject, emailFields),
        substituteFields(template.body, emailFields),
        'html',
      );
      return res.status(200).json(status).end();
    } catch (err) {
      logger.error(`PlanStatusController: update: fail with error: ${err.message} `);
      throw err;
    }
  }

  /**
   * Update plan amendment
   * @param {*} req : express req
   * @param {*} res : express resp
   */
  static async updateAmendment(req, res) {
    const {
      query: { isMinorAmendment },
      params,
      body,
      user,
    } = req;
    const { planId, confirmationId } = params;

    checkRequiredFields(['planId', 'confirmationId'], 'params', req);

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const confirmation = await PlanConfirmation.update(db, { id: confirmationId }, body);
      const allConfirmations = await PlanConfirmation.find(db, {
        plan_id: planId,
      });
      let allConfirmed = true;
      allConfirmations.map((c) => {
        if (!c.confirmed) {
          allConfirmed = false;
        }
        return undefined;
      });

      const plan = await PlanController.fetchPlan(planId, user);
      let responseJson = null;
      // update the amendment status when the last agreement holder confirms
      if (allConfirmed) {
        const planStatuses = await PlanStatus.find(db, { active: true });
        const statusCode =
          isMinorAmendment === 'true' ? PLAN_STATUS.STANDS_NOT_REVIEWED : PLAN_STATUS.SUBMITTED_FOR_FINAL_DECISION;
        const status = planStatuses.find((s) => s.code === statusCode);
        await PlanStatusHistory.create(db, {
          fromPlanStatusId: plan.status.id,
          toPlanStatusId: status.id,
          note: ' ',
          planId,
          userId: user.id,
        });
        const updatedPlan = await PlanStatusController.updatePlanStatus(planId, status, user);
        updatedPlan.status = status;
        responseJson = { allConfirmed, updatedPlan, confirmation };
      }
      responseJson = { allConfirmed, confirmation };
      return res.status(200).json(responseJson).end();
    } catch (err) {
      logger.error(`PlanStatusController:updateAmendment: fail with error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Create status history
   * @param {*} req : express req
   * @param {*} res : express resp
   */
  static async storeStatusHistory(req, res) {
    const { params, body, user } = req;
    const { planId } = params;

    checkRequiredFields(['planId'], 'params', req);
    checkRequiredFields(['fromPlanStatusId', 'toPlanStatusId', 'note'], 'body', req);

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const { id: historyId } = await PlanStatusHistory.create(db, {
        ...body,
        planId,
        userId: user.id,
      });
      const [planStatusHistory] = await PlanStatusHistory.findWithUser(db, {
        'plan_status_history.id': historyId,
      });
      return res.status(200).json(planStatusHistory).end();
    } catch (err) {
      logger.error(`PlanStatusController:storeStatusHistory: fail with error: ${err.message}`);
      throw err;
    }
  }

  static isPlanActive(statusId, planAmendmentTypeId) {
    if ([8, 9, 12, 20, 21, 22].indexOf(statusId) !== -1) return true;
    if (planAmendmentTypeId && [11, 13, 18].indexOf(statusId) !== -1) return true;
    return false;
  }

  static async getLatestLegalVersion(planId) {
    const latestLegalVersion = await db('plan_snapshot')
      .whereIn('status_id', Plan.legalStatuses)
      .andWhere({ plan_id: planId })
      .orderBy('created_at', 'desc')
      .first();
    return latestLegalVersion;
  }
}
