import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';
import Exemption from '../../libs/db2/model/exemption';
import ExemptionStatusHistory from '../../libs/db2/model/exemptionstatushistory';

const dm = new DataManager(config);
const { db, Agreement } = dm;

export default class ExemptionStatusController {
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
   * Transition exemption status (submit, approve, reject)
   */
  static async transition(req, res) {
    const {
      params: { agreementId, exemptionId },
      body: { action, comment },
      user,
    } = req;
    checkRequiredFields(['agreementId', 'exemptionId', 'action'], 'params', req);
    const trx = await db.transaction();
    try {
      await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);
      const exemption = await Exemption.findById(trx, exemptionId);
      if (!exemption || exemption.agreement_id != agreementId) {
        throw errorWithCode('Exemption not found or does not belong to agreement', 404);
      }
      let newStatus = exemption.status;
      let statusComment = comment || '';
      if (user.isRangeOfficer() && action === 'submit') {
        if (exemption.status !== 'draft' && exemption.status !== 'rejected') {
          throw errorWithCode('Can only submit draft or rejected exemptions for approval.', 403);
        }
        newStatus = 'pending';
        statusComment = statusComment || 'Submitted for approval';
      } else if (user.isDecisionMaker() && action === 'approve') {
        if (exemption.status !== 'pending') {
          throw errorWithCode('Exemption must be pending for approval.', 403);
        }
        newStatus = 'approved';
        statusComment = statusComment || 'Approved by Decision Maker';
      } else if (user.isDecisionMaker() && action === 'reject') {
        if (exemption.status !== 'pending') {
          throw errorWithCode('Exemption must be pending for rejection.', 403);
        }
        newStatus = 'rejected';
        statusComment = statusComment || 'Rejected by Decision Maker';
      } else {
        throw errorWithCode('You do not have permission to perform this action.', 403);
      }
      // Update exemption status
      await Exemption.update(trx, exemptionId, { status: newStatus });
      // Record status history
      await ExemptionStatusHistory.create(trx, {
        exemption_id: exemptionId,
        status: newStatus,
        changed_by: user.id,
        comment: statusComment,
      });
      await trx.commit();
      // TODO: send email notification (stub)
      res.status(200).json({ id: exemptionId, status: newStatus });
    } catch (error) {
      await trx.rollback();
      logger.error(`Error transitioning exemption status:`, error);
      throw error;
    }
  }
}
