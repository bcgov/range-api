import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';
import ExemptionStatusHistory from '../../libs/db2/model/exemptionstatushistory';

const dm = new DataManager(config);
const { db, Agreement } = dm;

const TABLE = 'exemption';

export default class ExemptionController {
  /**
   * Get all exemption history for an agreement
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async index(req, res) {
    const {
      params: { agreementId },
      user,
      query: { orderBy = 'created_at', order = 'desc', limit } = {},
    } = req;

    checkRequiredFields(['agreementId'], 'params', req);

    try {
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      let query = db(TABLE).where('agreement_id', agreementId);
      if (orderBy) query = query.orderBy(orderBy, order);
      if (limit) query = query.limit(parseInt(limit));
      const exemptions = await query;
      res.status(200).json(exemptions);
    } catch (error) {
      logger.error(`Error retrieving exemptions for agreement ${agreementId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new exemption record for an agreement
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async store(req, res) {
    const {
      params: { agreementId },
      body: { startDate, endDate, reason, justificationText },
      user,
    } = req;

    checkRequiredFields(['agreementId'], 'params', req);
    checkRequiredFields(['startDate', 'endDate', 'reason'], 'body', req);

    // Only Staff Agrologist or Admin can create
    if (!user.isRangeOfficer() && !user.isAdministrator()) {
      throw errorWithCode('Only Staff Agrologist or Admin can create exemptions.', 403);
    }

    const trx = await db.transaction();
    try {
      await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);
      const exemptionData = {
        agreement_id: agreementId,
        start_date: startDate,
        end_date: endDate,
        reason,
        justification_text: justificationText,
        status: 'draft',
      };
      const [newExemption] = await trx(TABLE).insert(exemptionData).returning('*');
      // Record status history
      await ExemptionStatusHistory.create(trx, {
        exemption_id: newExemption.id,
        status: 'draft',
        changed_by: user.id,
        comment: 'Created',
      });
      await trx.commit();
      // TODO: send email notification (stub)
      res.status(201).json(newExemption);
    } catch (error) {
      await trx.rollback();
      logger.error(`Error creating exemption for agreement ${agreementId}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing exemption record
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async update(req, res) {
    const {
      params: { agreementId, exemptionId },
      body: { startDate, endDate, reason, justificationText, action },
      user,
    } = req;

    checkRequiredFields(['agreementId', 'exemptionId'], 'params', req);

    const trx = await db.transaction();
    try {
      await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);
      const existing = await trx(TABLE).where({ id: exemptionId, agreement_id: agreementId }).first();
      if (!existing) {
        throw errorWithCode(`Exemption record not found or does not belong to agreement ${agreementId}`, 404);
      }
      // Workflow logic
      // Admin can always edit
      // Staff Agrologist can edit only if draft or rejected
      // Staff Agrologist can submit for approval (action: 'submit')
      // Decision Maker can approve/reject (action: 'approve'/'reject')
      // Agreement Holder cannot edit
      if (user.isAdministrator()) {
        // Admin can edit anything
      } else if (user.isRangeOfficer()) {
        if (existing.status === 'pending' || existing.status === 'approved') {
          throw errorWithCode('Cannot edit exemption while it is pending approval or approved.', 403);
        }
      } else if (user.isDecisionMaker()) {
        if (action !== 'approve' && action !== 'reject') {
          throw errorWithCode('Decision Maker can only approve or reject.', 403);
        }
        if (existing.status !== 'pending') {
          throw errorWithCode('Exemption must be pending for approval or rejection.', 403);
        }
      } else {
        throw errorWithCode('You do not have permission to update this exemption.', 403);
      }

      let newStatus = existing.status;
      let comment = '';
      if (user.isRangeOfficer() && action === 'submit') {
        if (existing.status !== 'draft' && existing.status !== 'rejected') {
          throw errorWithCode('Can only submit draft or rejected exemptions for approval.', 403);
        }
        newStatus = 'pending';
        comment = 'Submitted for approval';
      } else if (user.isDecisionMaker() && action === 'approve') {
        newStatus = 'approved';
        comment = 'Approved by Decision Maker';
      } else if (user.isDecisionMaker() && action === 'reject') {
        newStatus = 'rejected';
        comment = 'Rejected by Decision Maker';
      } else if (user.isAdministrator() || user.isRangeOfficer()) {
        // Normal edit
        comment = 'Edited';
      }

      const updateData = {};
      if (startDate !== undefined) updateData.start_date = startDate;
      if (endDate !== undefined) updateData.end_date = endDate;
      if (reason !== undefined) updateData.reason = reason;
      if (justificationText !== undefined) updateData.justification_text = justificationText;
      if (newStatus !== existing.status) updateData.status = newStatus;

      const [updated] = await trx(TABLE).where({ id: exemptionId }).update(updateData).returning('*');
      // Record status history if status changed or always for audit
      await ExemptionStatusHistory.create(trx, {
        exemption_id: exemptionId,
        status: newStatus,
        changed_by: user.id,
        comment,
      });
      await trx.commit();
      // TODO: send email notification (stub)
      res.status(200).json(updated);
    } catch (error) {
      await trx.rollback();
      logger.error(`Error updating exemption ${exemptionId} for agreement ${agreementId}:`, error);
      throw error;
    }
  }

  /**
   * Delete an exemption record and its history
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async destroy(req, res) {
    const {
      params: { agreementId, exemptionId },
      user,
    } = req;

    checkRequiredFields(['agreementId', 'exemptionId'], 'params', req);

    const trx = await db.transaction();
    try {
      await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);
      const existing = await trx(TABLE).where({ id: exemptionId, agreement_id: agreementId }).first();
      if (!existing) {
        throw errorWithCode(`Exemption record not found or does not belong to agreement ${agreementId}`, 404);
      }
      // Only Admin can always delete, Staff Agrologist can delete if draft or rejected
      if (user.isAdministrator()) {
        // ok
      } else if (user.isRangeOfficer()) {
        if (existing.status !== 'draft' && existing.status !== 'rejected') {
          throw errorWithCode('Cannot delete exemption unless it is draft or rejected.', 403);
        }
      } else {
        throw errorWithCode('You do not have permission to delete this exemption.', 403);
      }
      await trx(TABLE).where({ id: exemptionId }).del();
      // Record status history
      await ExemptionStatusHistory.create(trx, {
        exemption_id: exemptionId,
        status: 'deleted',
        changed_by: user.id,
        comment: 'Deleted',
      });
      await trx.commit();
      // TODO: send email notification (stub)
      res.status(204).send();
    } catch (error) {
      await trx.rollback();
      logger.error(`Error deleting exemption ${exemptionId} for agreement ${agreementId}:`, error);
      throw error;
    }
  }

  // Attachment methods removed: not relevant for new exemption table
}
