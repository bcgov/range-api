import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { EXEMPTION_STATUS } from '../../constants';
import { PlanRouteHelper } from '../helpers';
import ExemptionStatusHistory from '../../libs/db2/model/exemptionstatushistory';
import ExemptionAttachment from '../../libs/db2/model/exemptionattachment';
import Exemption from '../../libs/db2/model/exemption';
import { generateExemptionPDF } from './PDFGeneration';
import { deleteFileFromMinio, getFileBuffer } from '../../libs/minio';
import NotificationHelper from '../helpers/NotificationHelper';
import Zone from '../../libs/db2/model/zone';
import User from '../../libs/db2/model/user';
import { updateAgreementExemptions } from '../helpers/AgreementExemptionHelper';

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
      if (existing.status === EXEMPTION_STATUS.CANCELLED) {
        throw errorWithCode('Cannot add attachments to a cancelled exemption.', 403);
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
      const exemption = await trx(TABLE).where({ id: exemptionId, agreement_id: agreementId }).first();
      if (!exemption) {
        throw errorWithCode(`Exemption record not found or does not belong to agreement ${agreementId}`, 404);
      }
      if (exemption.status === EXEMPTION_STATUS.CANCELLED) {
        throw errorWithCode('Cannot delete attachments from a cancelled exemption.', 403);
      }
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

      // Delete from Minio first
      await deleteFileFromMinio(attachment.url);
      // Then delete from database
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
      const exemptionStatus = EXEMPTION_STATUS.PENDING_APPROVAL;
      const exemptionData = {
        agreement_id: agreementId,
        start_date: startDate,
        end_date: endDate,
        reason,
        justification_text: justificationText,
        status: exemptionStatus,
        user_id: user.id,
      };
      const [newExemption] = await trx(TABLE).insert(exemptionData).returning('*');
      // Record status transition history for the newly created exemption
      await ExemptionStatusHistory.create(trx, {
        exemption_id: newExemption.id,
        from_status: null,
        to_status: exemptionStatus,
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
      newExemption.attachments = createdAttachments;

      const fullExemption = await Exemption.findById(trx, newExemption.id);
      const [agreement] = await Agreement.find(trx, { forest_file_id: agreementId });
      const zone = await Zone.findById(trx, agreement.zoneId);
      const rangeOfficer = await User.findById(trx, zone.userId);
      const { emails } = await NotificationHelper.getParticipants(trx, agreementId);
      const emailFields = {
        '{agreementId}': agreementId,
        '{fromStatus}': 'created',
        '{toStatus}': newExemption.status,
        '{rangeOfficerName}': `${rangeOfficer.givenName} ${rangeOfficer.familyName}`,
        '{rangeOfficerEmail}': rangeOfficer.email,
        '{note}': 'Created' || ' ',
      };
      const emailAttachments = await ExemptionController.prepareEmailAttachments(
        fullExemption,
        fullExemption.attachments,
      );
      await NotificationHelper.sendEmail(trx, emails, 'Exemption Status Change', emailFields, emailAttachments);
      await trx.commit();
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
      body: { startDate, endDate, reason, justificationText, attachments, action },
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
      if (existing.status === EXEMPTION_STATUS.CANCELLED) {
        throw errorWithCode('Cannot perform any action on a cancelled exemption.', 403);
      }
      // Workflow logic
      // Admin can always edit or approve/reject/cancel
      // Staff Agrologist can edit if draft or rejected, and can submit (action: 'submit')
      // Decision Maker can edit and approve/reject/cancel
      // Agreement Holder cannot edit
      if (user.isAdministrator()) {
        // Admin can edit anything, or perform approval actions
        if (action && ['approve', 'reject', 'cancel'].includes(action)) {
          if (action === 'cancel') {
            if (existing.status === EXEMPTION_STATUS.CANCELLED) {
              throw errorWithCode('Exemption is already cancelled.', 403);
            }
          } else if (existing.status !== EXEMPTION_STATUS.PENDING_APPROVAL) {
            throw errorWithCode('Exemption must be pending for approval or rejection.', 403);
          }
        }
      } else if (user.isRangeOfficer()) {
        // Staff Agrologist can edit draft or rejected, or resubmit after rejection
        if (action === 'submit') {
          if (existing.status !== EXEMPTION_STATUS.DRAFT && existing.status !== EXEMPTION_STATUS.REJECTED) {
            throw errorWithCode('Can only submit draft or rejected exemptions for approval.', 403);
          }
        } else {
          // Normal edit - can only edit if draft or rejected
          if (existing.status === EXEMPTION_STATUS.PENDING_APPROVAL || existing.status === EXEMPTION_STATUS.APPROVED) {
            throw errorWithCode('Cannot edit exemption while it is pending approval or approved.', 403);
          }
        }
      } else if (user.isDecisionMaker()) {
        // Decision Maker can edit and perform approval actions
        if (action && ['approve', 'reject', 'cancel'].includes(action)) {
          if (action === 'cancel') {
            if (existing.status === EXEMPTION_STATUS.CANCELLED) {
              throw errorWithCode('Exemption is already cancelled.', 403);
            }
          } else if (existing.status !== EXEMPTION_STATUS.PENDING_APPROVAL) {
            throw errorWithCode('Exemption must be pending for approval or rejection.', 403);
          }
        }
      } else {
        throw errorWithCode('You do not have permission to update this exemption.', 403);
      }

      let newStatus = existing.status;
      let comment = '';
      if (user.isRangeOfficer() && action === 'submit') {
        if (existing.status !== EXEMPTION_STATUS.DRAFT && existing.status !== EXEMPTION_STATUS.REJECTED) {
          throw errorWithCode('Can only submit draft or rejected exemptions for approval.', 403);
        }
        newStatus = EXEMPTION_STATUS.PENDING_APPROVAL;
        comment = 'Submitted for approval';
      } else if ((user.isDecisionMaker() || user.isAdministrator()) && action === 'approve') {
        newStatus = EXEMPTION_STATUS.APPROVED;
        comment = 'Approved by Decision Maker';
      } else if ((user.isDecisionMaker() || user.isAdministrator()) && action === 'reject') {
        newStatus = EXEMPTION_STATUS.REJECTED;
        comment = 'Rejected by Decision Maker';
      } else if ((user.isDecisionMaker() || user.isAdministrator()) && action === 'cancel') {
        newStatus = EXEMPTION_STATUS.CANCELLED;
        comment = 'Cancelled by Decision Maker';
      } else if (user.isAdministrator() || user.isRangeOfficer() || user.isDecisionMaker()) {
        // Normal edit
        newStatus = EXEMPTION_STATUS.PENDING_APPROVAL;
        comment = 'Edited';
      }

      const updateData = {};
      if (startDate !== undefined) updateData.start_date = startDate;
      if (endDate !== undefined) updateData.end_date = endDate;
      if (reason !== undefined) updateData.reason = reason;
      if (justificationText !== undefined) updateData.justification_text = justificationText;
      if (newStatus !== existing.status) {
        updateData.status = newStatus;
        if (newStatus === EXEMPTION_STATUS.APPROVED) {
          updateData.approved_by = user.id;
          updateData.approval_date = new Date();
        }
      }

      const [updated] = await trx(TABLE).where({ id: exemptionId }).update(updateData).returning('*');
      // Record status transition history if status changed or always for audit
      await ExemptionStatusHistory.create(trx, {
        exemption_id: exemptionId,
        from_status: existing.status,
        to_status: newStatus,
        note: comment || null,
        user_id: user.id,
      });

      // Handle attachments - merge with existing ones
      if (Array.isArray(attachments)) {
        // Get existing attachments
        const existingAttachments = await trx('exemption_attachment').where({ exemption_id: exemptionId });

        // Identify attachments to delete (in DB but not in request)
        const incomingUrls = attachments.map((a) => a.url);
        const attachmentsToDelete = existingAttachments.filter((ea) => !incomingUrls.includes(ea.url));

        // Delete attachments that are no longer in the list
        if (attachmentsToDelete.length > 0) {
          // Delete from Minio first
          for (const attachment of attachmentsToDelete) {
            await deleteFileFromMinio(attachment.url);
          }
          // Then delete from database
          await trx('exemption_attachment')
            .whereIn(
              'id',
              attachmentsToDelete.map((a) => a.id),
            )
            .del();
        }

        // Identify new attachments (in request but not in DB)
        const existingUrls = existingAttachments.map((ea) => ea.url);
        const newAttachments = attachments.filter((a) => !existingUrls.includes(a.url));

        // Insert new attachments
        const createdAttachments = [];
        for (const a of newAttachments) {
          const name = a.name;
          const url = a.url;
          const type = a.type || 'file';
          const access = a.access || 'staff_only';
          if (!name || !url) {
            await trx.rollback();
            return res.status(400).json({ error: 'Each attachment must include name and url', success: false });
          }
          const [att] = await trx('exemption_attachment')
            .insert({ name, url, type, access, exemption_id: exemptionId, user_id: user.id })
            .returning('*');
          createdAttachments.push(att);
        }

        // Fetch all current attachments (existing + newly created)
        updated.attachments = await trx('exemption_attachment').where({ exemption_id: exemptionId });
      }

      await updateAgreementExemptions(trx, user, agreementId);

      await trx.commit();

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
        if (existing.status !== EXEMPTION_STATUS.DRAFT && existing.status !== EXEMPTION_STATUS.REJECTED) {
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
        to_status: EXEMPTION_STATUS.DELETED,
        note: 'Deleted',
        user_id: user.id,
      });
      await updateAgreementExemptions(trx, user, agreementId);
      await trx.commit();
      res.status(204).send();
    } catch (error) {
      await trx.rollback();
      logger.error(`Error deleting exemption ${exemptionId} for agreement ${agreementId}:`, error);
      throw error;
    }
  }

  static async downloadPDF(req, res) {
    const { params } = req;
    const { exemptionId } = params;
    checkRequiredFields(['exemptionId'], 'params', req);
    const exemption = await Exemption.findById(db, exemptionId);
    const agreement = await Agreement.findById(db, exemption.agreementId);
    console.log('agreement', agreement);
    if (agreement) {
      await agreement.fetchClients();
      exemption.agreement = agreement;
    }
    const response = await generateExemptionPDF(exemption);
    res.json(response.data).end();
  }

  static async prepareEmailAttachments(exemption, attachments) {
    const emailAttachments = [];

    // 1. Generated PDF
    try {
      const agreement = await Agreement.findById(db, exemption.agreementId);
      console.log('agreement', agreement);
      if (agreement) {
        await agreement.fetchClients();
        exemption.agreement = agreement;
      }
      const pdfResponse = await generateExemptionPDF(exemption);
      emailAttachments.push({
        content: Buffer.from(pdfResponse.data).toString('base64'),
        contentType: 'application/pdf',
        filename: `Exemption_${exemption.agreementId}_${exemption.id}.pdf`,
        encoding: 'base64',
      });
    } catch (err) {
      logger.error(`Error generating PDF for email: ${err.message}`);
    }

    // 2. File Attachments
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        try {
          const buffer = await getFileBuffer(att.url);
          emailAttachments.push({
            content: buffer.toString('base64'),
            contentType: 'application/octet-stream',
            filename: att.name,
            encoding: 'base64',
          });
        } catch (err) {
          logger.error(`Error fetching attachment ${att.name} for email: ${err.message}`);
        }
      }
    }

    return emailAttachments;
  }
}
