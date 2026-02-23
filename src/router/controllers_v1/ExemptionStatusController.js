import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { EXEMPTION_STATUS, SSO_ROLE_MAP, SYSTEM_USER_ID } from '../../constants';
import { PlanRouteHelper } from '../helpers';
import Exemption from '../../libs/db2/model/exemption';
import ExemptionStatusHistory from '../../libs/db2/model/exemptionstatushistory';
import NotificationHelper from '../helpers/NotificationHelper';
import ExemptionController from './ExemptionController';
import Zone from '../../libs/db2/model/zone';
import User from '../../libs/db2/model/user';
import { updateAgreementExemptions } from '../helpers/AgreementExemptionHelper';

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
    const trx = await db.transaction();
    const emailExclusions = [SSO_ROLE_MAP.DECISION_MAKER];
    try {
      await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);
      const exemption = await Exemption.findById(trx, exemptionId);
      if (!exemption || exemption.agreementId != agreementId) {
        throw errorWithCode('Exemption not found or does not belong to agreement', 404);
      }
      let newStatus = exemption.status;
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

      const updatedExemption = await ExemptionStatusController.performExemptionTransition(
        trx,
        exemptionId,
        newStatus,
        comment,
        user,
        agreementId,
        exemption,
        emailExclusions,
      );

      await trx.commit();
      res.status(200).json({ id: updatedExemption.id, status: updatedExemption.status });
    } catch (error) {
      await trx.rollback();
      logger.error(`Error transitioning exemption status:`, error);
      throw error;
    }
  }
}
