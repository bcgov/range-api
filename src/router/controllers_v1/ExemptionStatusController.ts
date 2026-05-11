// @ts-nocheck
import { errorWithCode, logger } from '../../libs/bcgov-shim.js';
import { checkRequiredFields } from '../../libs/utils.js';
import DataManager from '../../libs/db2/index.js';
import config from '../../config/index.js';
import { EXEMPTION_STATUS, SSO_ROLE_MAP, SYSTEM_USER_ID } from '../../constants.js';
import { PlanRouteHelper } from '../helpers/index.js';
import Exemption from '../../libs/db2/model/exemption.js';
import ExemptionStatusHistory from '../../libs/db2/model/exemptionstatushistory.js';
import NotificationHelper from '../helpers/NotificationHelper.js';
import ExemptionController from './ExemptionController.js';
import Zone from '../../libs/db2/model/zone.js';
import User from '../../libs/db2/model/user.js';
import { updateAgreementExemptions } from '../helpers/AgreementExemptionHelper.js';

const dm = new DataManager(config);
const { db, Agreement } = dm;

export default class ExemptionStatusController {
  /**
   * Helper to perform exemption status transition logic.
   * @param {*} trx
   * @param {*} exemptionId
   * @param {*} newStatus
   * @param {*} comment
   * @param {*} user
   * @param {*} agreementId // Passed for notification purposes
   * @param {*} exemption // The exemption object itself
   */
  static async performExemptionTransition(
    trx,
    exemptionId,
    newStatus,
    comment,
    user = null,
    agreementId,
    exemption,
    emailExclusions,
  ) {
    const statusComment = comment || '';
    const updateData = { status: newStatus };

    // Determine the user ID for history and approved_by
    let actingUserId = SYSTEM_USER_ID; // Default to system user
    if (user && user.id) {
      actingUserId = user.id;
    }

    if (newStatus === EXEMPTION_STATUS.APPROVED) {
      updateData.approved_by = actingUserId;
      updateData.approval_date = new Date();
    }
    const updatedExemption = await Exemption.update(trx, { id: exemptionId }, updateData);
    // Record status transition history
    await ExemptionStatusHistory.create(trx, {
      exemption_id: exemptionId,
      from_status: exemption.status,
      to_status: newStatus,
      note: statusComment || null,
      user_id: actingUserId,
    });

    const [agreement] = await Agreement.find(trx, { forest_file_id: agreementId });
    const zone = await Zone.findById(trx, agreement.zoneId);
    const rangeOfficer = await User.findById(trx, zone.userId);

    const { emails } = await NotificationHelper.getParticipants(trx, agreementId, emailExclusions);
    const emailFields = {
      '{agreementId}': agreementId,
      '{fromStatus}': exemption.status,
      '{toStatus}': newStatus,
      '{rangeOfficerName}': `${rangeOfficer.givenName} ${rangeOfficer.familyName}`,
      '{rangeOfficerEmail}': rangeOfficer.email,
      '{note}': statusComment || ' ',
    };
    const emailAttachments = await ExemptionController.prepareEmailAttachments(
      updatedExemption,
      updatedExemption.attachments,
    );
    await NotificationHelper.sendEmail(trx, emails, 'Exemption Status Change', emailFields, emailAttachments);

    // Send Response Required email to decision makers when status changes to PENDING_APPROVAL
    if (newStatus === EXEMPTION_STATUS.PENDING_APPROVAL && exemption.status !== EXEMPTION_STATUS.PENDING_APPROVAL) {
      const { emails: decisionMakerEmails } = await NotificationHelper.getParticipants(trx, agreementId, [
        SSO_ROLE_MAP.RANGE_OFFICER,
        SSO_ROLE_MAP.AGREEMENT_HOLDER,
      ]);
      const responseFields = {
        '{agreementId}': agreementId,
      };
      await NotificationHelper.sendEmail(trx, decisionMakerEmails, 'Response Required', responseFields);
    }

    await updateAgreementExemptions(trx, user, agreementId);

    return updatedExemption;
  }

  /**
   * Get status history for an exemption
   */
  static async history(req, res) {
    const {
      params: { agreementId, exemptionId },
      user,
    } = req;
    checkRequiredFields(['agreementId', 'exemptionId'], 'params', req);
    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
    const history = await ExemptionStatusHistory.findByExemptionId(db, exemptionId);
    res.status(200).json(history);
  }

  /**
   * Transition exemption status (submit, approve, reject, cancel)
   */
  static async transition(req, res) {
    const {
      params: { agreementId, exemptionId },
      body: { action, comment },
      user,
    } = req;
    checkRequiredFields(['agreementId', 'exemptionId'], 'params', req);
    checkRequiredFields(['action'], 'body', req);
    const emailExclusions = [SSO_ROLE_MAP.DECISION_MAKER];
    let updatedExemption;
    try {
      await db.transaction().execute(async (trx) => {
        await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);
        const exemption = await Exemption.findById(trx, exemptionId);
        if (!exemption || exemption.agreementId != agreementId) {
          throw errorWithCode('Exemption not found or does not belong to agreement', 404);
        }
        let newStatus;
        if (user.isRangeOfficer() && action === 'submit') {
          if (exemption.status !== EXEMPTION_STATUS.DRAFT && exemption.status !== EXEMPTION_STATUS.REJECTED) {
            throw errorWithCode('Can only submit draft or rejected exemptions for approval.', 403);
          }
          newStatus = EXEMPTION_STATUS.PENDING_APPROVAL;
          emailExclusions.push(...[SSO_ROLE_MAP.AGREEMENT_HOLDER, SSO_ROLE_MAP.RANGE_OFFICER]);
        } else if ((user.isDecisionMaker() || user.isAdministrator()) && action === 'approve') {
          if (exemption.status !== EXEMPTION_STATUS.PENDING_APPROVAL) {
            throw errorWithCode('Exemption must be pending for approval.', 403);
          }
          newStatus = EXEMPTION_STATUS.APPROVED;
        } else if ((user.isDecisionMaker() || user.isAdministrator()) && action === 'reject') {
          if (exemption.status !== EXEMPTION_STATUS.PENDING_APPROVAL) {
            throw errorWithCode('Exemption must be pending for rejection.', 403);
          }
          newStatus = EXEMPTION_STATUS.REJECTED;
          emailExclusions.push(...[SSO_ROLE_MAP.AGREEMENT_HOLDER]);
        } else if ((user.isDecisionMaker() || user.isAdministrator()) && action === 'cancel') {
          if (exemption.status === EXEMPTION_STATUS.CANCELLED) {
            throw errorWithCode('Exemption is already cancelled.', 403);
          }
          newStatus = EXEMPTION_STATUS.CANCELLED;
        } else {
          throw errorWithCode('You do not have permission to perform this action.', 403);
        }

        updatedExemption = await ExemptionStatusController.performExemptionTransition(
          trx,
          exemptionId,
          newStatus,
          comment,
          user,
          agreementId,
          exemption,
          emailExclusions,
        );
      });
      res.status(200).json({ id: updatedExemption.id, status: updatedExemption.status });
    } catch (error) {
      logger.error(`Error transitioning exemption status:`, error);
      throw error;
    }
  }
}
