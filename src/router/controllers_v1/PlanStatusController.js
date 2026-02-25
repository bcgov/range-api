import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { isNumeric, checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import moment from 'moment';
import { AGREEMENT_EXEMPTION_STATUS, EXEMPTION_STATUS, PLAN_STATUS, SSO_ROLE_MAP } from '../../constants';
import { PlanRouteHelper } from '../helpers';
import PlanSnapshot from '../../libs/db2/model/plansnapshot';
import PlanController from './PlanController';
import NotificationHelper from '../helpers/NotificationHelper';
import Zone from '../../libs/db2/model/zone';
import User from '../../libs/db2/model/user';
import ExemptionStatusController from './ExemptionStatusController';

const dm = new DataManager(config);
const { db, Plan, PlanConfirmation, PlanStatusHistory, PlanStatus, Agreement, Exemption } = dm;

export default class PlanStatusController {
  /**
   * Update Plan status
   * @param {*} planId : string
   * @param {*} status : object
   * @param {*} user : Models/User
   */
  static async updatePlanStatus(trx, planId, status = {}, user) {
    try {
      const body = { status_id: status.id };
      switch (status.code) {
        case PLAN_STATUS.APPROVED:
        case PLAN_STATUS.STANDS:
        case PLAN_STATUS.WRONGLY_MADE_WITHOUT_EFFECT:
        case PLAN_STATUS.STANDS_NOT_REVIEWED: {
          let comment = 'Exemption cancelled due to plan status change.';
          if (status.code === PLAN_STATUS.APPROVED) {
            body.effective_at = new Date();
            comment = 'Exemption cancelled due to plan approval.';
          } else if (status.code === PLAN_STATUS.STANDS) {
            body.effective_at = new Date();
            body.submitted_at = new Date();
            comment = 'Exemption cancelled due to plan status change to stands.';
          } else if (status.code === PLAN_STATUS.WRONGLY_MADE_WITHOUT_EFFECT) {
            body.effective_at = null;
            comment = 'Exemption cancelled due to plan status change to wrongly made without effect.';
          } else if (status.code === PLAN_STATUS.STANDS_NOT_REVIEWED) {
            comment = 'Exemption cancelled due to plan status change to stands not reviewed.';
          }

          const { agreement_id: agreementId } = await Plan.agreementForPlanId(trx, planId);
          await PlanStatusController.cancelActiveExemptionsForAgreement(trx, agreementId, planId, user, comment);
          break;
        }
        case PLAN_STATUS.SUBMITTED_FOR_FINAL_DECISION:
        case PLAN_STATUS.SUBMITTED_FOR_REVIEW:
          body.submitted_at = new Date();
          break;
        case PLAN_STATUS.AWAITING_CONFIRMATION:
          // refresh all the old confirmations and start fresh
          await PlanConfirmation.refreshConfirmations(trx, planId, user);
          break;
        default:
          break;
      }

      // Don't create a snapshot if the plan we're updating the status for
      // already has a legal status
      const originalPlan = await Plan.findById(trx, planId);
      if (!originalPlan.isRestored && !Plan.isLegal(originalPlan) && !originalPlan.statusId === status.id) {
        await Plan.createSnapshot(trx, planId, user);
      }

      const updatedPlan = await Plan.update(trx, { id: planId }, { ...body, is_restored: false });

      // If the new status was legal, create a snapshot after updating
      if (
        (!originalPlan.isRestored && Plan.isLegal(updatedPlan)) ||
        status.code === PLAN_STATUS.NOT_APPROVED ||
        (Plan.isLegal(originalPlan) && !Plan.isLegal(updatedPlan))
      ) {
        await Plan.createSnapshot(trx, planId, user);
      }

      if (status.code === PLAN_STATUS.WRONGLY_MADE_WITHOUT_EFFECT) {
        /*
         *  The previous legal version should always be right before the "stands"
         *  version for the minor amendment that was just determined to be
         *  wrongly made without effect.
         */
        await Plan.createSnapshot(trx, planId, user);
        const prevLegal = await PlanStatusController.getLatestLegalVersion(planId, [8, 9, 12]);
        await Plan.restoreVersion(trx, planId, prevLegal.version, true);
        await PlanStatusHistory.create(trx, {
          fromPlanStatusId: status.id,
          toPlanStatusId: prevLegal.snapshot.statusId,
          note: 'restored',
          planId,
          userId: user.id,
        });
      }

      if (status.code === PLAN_STATUS.NOT_APPROVED) {
        const prevLegal = await PlanStatusController.getLatestLegalVersion(planId);
        const {
          rows: [{ max: lastVersion }],
        } = await trx.raw(
          `
          SELECT MAX(version) FROM plan_snapshot
          WHERE plan_id = ?
        `,
          [planId],
        );

        await PlanSnapshot.create(
          trx,
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

  static async cancelActiveExemptionsForAgreement(trx, agreementId, planId, user, comment) {
    const approvedExemptions = await Exemption.find(trx, {
      agreement_id: agreementId,
      status: EXEMPTION_STATUS.APPROVED,
    });

    const today = moment().startOf('day');
    const trulyActiveExemptions = approvedExemptions.filter((ex) => {
      const startDate = moment(ex.start_date).startOf('day');
      const endDate = moment(ex.end_date).startOf('day');
      return today.isBetween(startDate, endDate, null, '[]');
    });

    if (trulyActiveExemptions.length > 0) {
      for (const exemption of trulyActiveExemptions) {
        await ExemptionStatusController.performExemptionTransition(
          trx,
          exemption.id,
          EXEMPTION_STATUS.CANCELLED,
          comment,
          user,
          agreementId,
          exemption,
          [SSO_ROLE_MAP.DECISION_MAKER],
        );
      }

      // Update agreement exemption status to NOT_EXEMPTED
      await Agreement.update(
        trx,
        { forest_file_id: agreementId },
        { exemption_status: AGREEMENT_EXEMPTION_STATUS.NOT_EXEMPTED },
      );
      // Notification for exemption cancellation is handled within performExemptionTransition
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
    const trx = await db.transaction();
    checkRequiredFields(['planId'], 'params', req);
    checkRequiredFields(['statusId'], 'body', req);

    if (!isNumeric(statusId)) {
      throw errorWithCode('statusId must be numeric', 400);
    }

    try {
      const { agreement_id: agreementId } = await Plan.agreementForPlanId(trx, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);
      const planStatuses = await PlanStatus.find(trx, { active: true });
      // make sure the status exists.
      const status = planStatuses.find((s) => s.id === statusId);
      if (!status) {
        throw errorWithCode('You must supply a valid status ID', 403);
      }
      const plan = await Plan.findById(trx, planId);
      const { statusId: prevStatusId } = plan;
      await PlanStatusHistory.create(trx, {
        fromPlanStatusId: prevStatusId,
        toPlanStatusId: statusId,
        note: note || ' ',
        planId,
        userId: user.id,
      });
      await PlanStatusController.updatePlanStatus(trx, planId, status, user);

      const [agreement] = await Agreement.find(trx, { forest_file_id: agreementId });
      const zone = await Zone.findById(trx, agreement.zoneId);
      const rangeOfficer = await User.findById(trx, zone.userId);

      const toStatus = await PlanStatus.findById(trx, statusId);
      const fromStatus = await PlanStatus.findById(trx, prevStatusId);
      const emailFields = {
        '{agreementId}': agreementId,
        '{fromStatus}': fromStatus.name,
        '{toStatus}': toStatus.name,
        '{rangeOfficerName}': `${rangeOfficer.givenName} ${rangeOfficer.familyName}`,
        '{rangeOfficerEmail}': rangeOfficer.email,
        '{note}': note || ' ',
      };

      // If status requires decision maker action, send Response Required to decision makers only
      if (
        status.code === PLAN_STATUS.STANDS_REVIEW ||
        status.code === PLAN_STATUS.RECOMMEND_READY ||
        status.code === PLAN_STATUS.RECOMMEND_NOT_READY
      ) {
        const { emails: decisionMakerEmails } = await NotificationHelper.getParticipants(trx, agreementId, [
          SSO_ROLE_MAP.RANGE_OFFICER,
          SSO_ROLE_MAP.AGREEMENT_HOLDER,
        ]);
        const responseFields = {
          '{agreementId}': agreementId,
        };
        await NotificationHelper.sendEmail(trx, decisionMakerEmails, 'Response Required', responseFields);
      }
      // For other statuses, send Plan Status Change email excluding decision makers
      const { emails } = await NotificationHelper.getParticipants(trx, agreementId, [SSO_ROLE_MAP.DECISION_MAKER]);
      await NotificationHelper.sendEmail(trx, emails, 'Plan Status Change', emailFields);

      trx.commit();
      return res.status(200).json(status).end();
    } catch (err) {
      trx.rollback();
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
    const trx = await db.transaction();
    checkRequiredFields(['planId', 'confirmationId'], 'params', req);

    try {
      const agreementId = await Plan.agreementIdForPlanId(trx, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);

      const confirmation = await PlanConfirmation.update(trx, { id: confirmationId }, body);
      const allConfirmations = await PlanConfirmation.find(trx, {
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
        const planStatuses = await PlanStatus.find(trx, { active: true });
        const statusCode =
          isMinorAmendment === 'true' ? PLAN_STATUS.STANDS_NOT_REVIEWED : PLAN_STATUS.SUBMITTED_FOR_FINAL_DECISION;
        const status = planStatuses.find((s) => s.code === statusCode);
        await PlanStatusHistory.create(trx, {
          fromPlanStatusId: plan.status.id,
          toPlanStatusId: status.id,
          note: ' ',
          planId,
          userId: user.id,
        });
        const updatedPlan = await PlanStatusController.updatePlanStatus(trx, planId, status, user);
        updatedPlan.status = status;
        responseJson = { allConfirmed, updatedPlan, confirmation };
      }
      responseJson = { allConfirmed, confirmation };
      trx.commit();
      return res.status(200).json(responseJson).end();
    } catch (err) {
      trx.rollback();
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

  static async getLatestLegalVersion(planId, legalStatusesToSearch) {
    const latestLegalVersion = await db('plan_snapshot')
      .whereIn('status_id', legalStatusesToSearch || Plan.legalStatuses)
      .andWhere({ plan_id: planId })
      .orderBy('created_at', 'desc')
      .first();
    return latestLegalVersion;
  }
}
