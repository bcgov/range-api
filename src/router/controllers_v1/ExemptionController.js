import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';
import ExemptionStatusHistory from '../../libs/db2/model/exemptionstatushistory';
import ExemptionAttachment from '../../libs/db2/model/exemptionattachment';
import Exemption from '../../libs/db2/model/exemption';

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
      query: { orderBy = 'created_at', order = 'desc' } = {},
    } = req;

    checkRequiredFields(['agreementId'], 'params', req);

    try {
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const exemptions = await Exemption.findByAgreementId(db, agreementId, orderBy, order);
      for (const exemption of exemptions) {
        exemption.attachments = await ExemptionAttachment.findByExemptionId(db, exemption.id);
      }
      res.status(200).json(exemptions);
    } catch (error) {
      logger.error(`Error retrieving exemptions for agreement ${agreementId}:`, error);
      throw error;
    }
  }

  /**
   * List attachments for an exemption
   */
  static async getAttachments(req, res) {
    const {
      params: { agreementId, exemptionId },
      user,
    } = req;
    checkRequiredFields(['agreementId', 'exemptionId'], 'params', req);
    try {
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
      const attachments = await ExemptionAttachment.findByExemptionId(db, exemptionId);
      res.status(200).json(attachments);
    } catch (error) {
      logger.error(`Error retrieving attachments for exemption ${exemptionId} agreement ${agreementId}:`, error);
      throw error;
    }
  }

  /**
   * Upload one or more attachments for an exemption (JSON body or multipart handled elsewhere)
   * Body: { attachments: [{ name, url, type, access }] }
   */
  static async uploadAttachment(req, res) {
    const {
      params: { agreementId, exemptionId },
      user,
    } = req;
    checkRequiredFields(['agreementId', 'exemptionId'], 'params', req);

    // Only Staff Agrologist or Admin can add attachments
    if (!user.isRangeOfficer() && !user.isAdministrator()) {
      throw errorWithCode('Only Staff Agrologist or Admin can add attachments to exemptions.', 403);
    }

    const attachments = req.body && Array.isArray(req.body.attachments) ? req.body.attachments : [];
    if (attachments.length === 0) {
      return res.status(400).json({
        error: 'There are missing fields in the body. Required: attachments (non-empty array)',
        success: false,
      });
    }

    const trx = await db.transaction();
    try {
      await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);
      const existing = await trx(TABLE).where({ id: exemptionId, agreement_id: agreementId }).first();
      if (!existing) {
        throw errorWithCode(`Exemption record not found or does not belong to agreement ${agreementId}`, 404);
      }

      const rows = [];
      for (const a of attachments) {
        const { name, url, type = 'file', access = 'staff_only' } = a;
        if (!name || !url) {
          await trx.rollback();
          return res.status(400).json({ error: 'Each attachment must include name and url', success: false });
        }
        const [row] = await trx('exemption_attachment')
          .insert({ name, url, type, access, exemption_id: exemptionId, user_id: user.id })
          .returning('*');
        rows.push(row);
      }

      await trx.commit();
      res.status(201).json(rows);
    } catch (error) {
      await trx.rollback();
      logger.error(`Error uploading attachments for exemption ${exemptionId} agreement ${agreementId}:`, error);
      throw error;
    }
  }

  /**
   * Delete attachment
   */
  static async deleteAttachment(req, res) {
    const {
      params: { agreementId, exemptionId, attachmentId },
      user,
    } = req;
    checkRequiredFields(['agreementId', 'exemptionId', 'attachmentId'], 'params', req);

    const trx = await db.transaction();
    try {
      await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);
      const attachment = await trx('exemption_attachment')
        .select('exemption_attachment.*')
        .where('exemption_attachment.id', attachmentId)
        .andWhere('exemption_attachment.exemption_id', exemptionId)
        .first();

      if (!attachment) {
        throw errorWithCode('Attachment not found for this exemption', 404);
      }

      if (!user.isAdministrator() && user.id !== attachment.user_id) {
        throw errorWithCode('You do not have permission to delete this attachment', 403);
      }

      await trx('exemption_attachment').where({ id: attachmentId }).del();
      await trx.commit();
      res.status(204).send();
    } catch (error) {
      await trx.rollback();
      logger.error(
        `Error deleting attachment ${attachmentId} for exemption ${exemptionId} agreement ${agreementId}:`,
        error,
      );
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
      body: { startDate, endDate, reason, justificationText, attachments = [] },
      user,
    } = req;
    checkRequiredFields(['agreementId'], 'params', req);
    checkRequiredFields(['startDate', 'endDate', 'reason', 'justificationText'], 'body', req);

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
      // Record status transition history for the newly created exemption
      await ExemptionStatusHistory.create(trx, {
        exemption_id: newExemption.id,
        from_status: null,
        to_status: 'draft',
        note: null,
        user_id: user.id,
      });

      // If attachments are provided in the request body, persist them linked to the history record
      const createdAttachments = [];
      if (attachments.length > 0) {
        for (const a of attachments) {
          const name = a.name;
          const url = a.url;
          const type = a.type || 'file';
          const access = a.access || 'everyone';
          if (!name || !url) {
            await trx.rollback();
            return res.status(400).json({ error: 'Each attachment must include name and url', success: false });
          }
          const [att] = await trx('exemption_attachment')
            .insert({ name, url, type, access, exemption_id: newExemption.id, user_id: user.id })
            .returning('*');
          createdAttachments.push(att);
        }
      }

      await trx.commit();
      // TODO: send email notification (stub)
      res.status(201).json({ exemption: newExemption, attachments: createdAttachments });
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
      // Record status transition history if status changed or always for audit
      await ExemptionStatusHistory.create(trx, {
        exemption_id: exemptionId,
        from_status: existing.status,
        to_status: newStatus,
        note: comment || null,
        user_id: user.id,
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
      // Record status transition history for deletion
      await ExemptionStatusHistory.create(trx, {
        exemption_id: exemptionId,
        from_status: existing.status,
        to_status: 'deleted',
        note: 'Deleted',
        user_id: user.id,
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
