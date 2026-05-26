// @ts-nocheck
import { errorWithCode, logger } from '../../libs/bcgov-shim.js';
import { checkRequiredFields } from '../../libs/utils.js';
import DataManager from '../../libs/db2/index.js';
import config from '../../config/index.js';
import { EXEMPTION_STATUS, AGREEMENT_EXEMPTION_STATUS, SSO_ROLE_MAP } from '../../constants.js';
import { PlanRouteHelper } from '../helpers/index.js';
import ExemptionStatusHistory from '../../libs/db2/model/exemptionstatushistory.js';
import ExemptionAttachment from '../../libs/db2/model/exemptionattachment.js';
import Exemption from '../../libs/db2/model/exemption.js';
import { generateExemptionPDF } from './PDFGeneration.js';
import { deleteFileFromMinio, getFileBuffer } from '../../libs/minio.js';
import NotificationHelper from '../helpers/NotificationHelper.js';
import Zone from '../../libs/db2/model/zone.js';
import User from '../../libs/db2/model/user.js';
import { updateAgreementExemptions } from '../helpers/AgreementExemptionHelper.js';

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

    let rows;
    try {
      await db.transaction().execute(async (trx) => {
        await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);
        const existing = await trx
          .selectFrom(TABLE)
          .selectAll()
          .where('id', '=', exemptionId)
          .where('agreement_id', '=', agreementId)
          .executeTakeFirst();
        if (!existing) {
          throw errorWithCode(`Exemption record not found or does not belong to agreement ${agreementId}`, 404);
        }
        if (existing.status === EXEMPTION_STATUS.CANCELLED) {
          throw errorWithCode('Cannot add attachments to a cancelled exemption.', 403);
        }

        rows = [];
        for (const a of attachments) {
          const { name, url, type = 'file', access = 'staff_only' } = a;
          if (!name || !url) {
            throw errorWithCode('Each attachment must include name and url', 400);
          }
          const row = await trx
            .insertInto('exemption_attachment')
            .values({ name, url, type, access, exemption_id: exemptionId, user_id: user.id })
            .returningAll()
            .executeTakeFirst();
          rows.push(row);
        }
      });
      res.status(201).json(rows);
    } catch (error) {
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

    try {
      await db.transaction().execute(async (trx) => {
        await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);
        const exemption = await trx
          .selectFrom('exemption')
          .where('id', '=', exemptionId)
          .where('agreement_id', '=', agreementId)
          .executeTakeFirst();
        if (!exemption) {
          throw errorWithCode(`Exemption record not found or does not belong to agreement ${agreementId}`, 404);
        }
        if (exemption.status === EXEMPTION_STATUS.CANCELLED) {
          throw errorWithCode('Cannot delete attachments from a cancelled exemption.', 403);
        }
        const attachment = await trx
          .selectFrom('exemption_attachment')
          .selectAll('exemption_attachment')
          .where('exemption_attachment.id', '=', attachmentId)
          .where('exemption_attachment.exemption_id', '=', exemptionId)
          .executeTakeFirst();

        if (!attachment) {
          throw errorWithCode('Attachment not found for this exemption', 404);
        }

        if (!user.isAdministrator() && user.id !== attachment.user_id) {
          throw errorWithCode('You do not have permission to delete this attachment', 403);
        }

        // Delete from Minio first
        await deleteFileFromMinio(attachment.url);
        // Then delete from database
        await trx.deleteFrom('exemption_attachment').where('id', '=', attachmentId).execute();
      });
      res.status(204).send();
    } catch (error) {
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

    let newExemption;
    try {
      await db.transaction().execute(async (trx) => {
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
        newExemption = await trx.insertInto(TABLE).values(exemptionData).returningAll().executeTakeFirst();
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
              throw errorWithCode('Each attachment must include name and url', 400);
            }
            const att = await trx
              .insertInto('exemption_attachment')
              .values({ name, url, type, access, exemption_id: newExemption.id, user_id: user.id })
              .returningAll()
              .executeTakeFirst();
            createdAttachments.push(att);
          }
        }
        newExemption.attachments = createdAttachments;

        const [agreement] = await Agreement.find(trx, { forest_file_id: agreementId });

        // Set agreement exemption status to IN_PROGRESS when exemption is created
        await Agreement.update(
          trx,
          { forest_file_id: agreementId },
          { exemption_status: AGREEMENT_EXEMPTION_STATUS.IN_PROGRESS },
        );

        const zone = await Zone.findById(trx, agreement.zoneId);
        const rangeOfficer = await User.findById(trx, zone.userId);
        const { emails } = await NotificationHelper.getParticipants(trx, agreementId, [
          SSO_ROLE_MAP.AGREEMENT_HOLDER,
          SSO_ROLE_MAP.RANGE_OFFICER,
        ]);
        const emailFields = {
          '{agreementId}': agreementId,
          '{fromStatus}': 'created',
          '{toStatus}': newExemption.status,
          '{rangeOfficerName}': `${rangeOfficer.givenName} ${rangeOfficer.familyName}`,
          '{rangeOfficerEmail}': rangeOfficer.email,
          '{note}': 'Created' || ' ',
        };
        await NotificationHelper.sendEmail(trx, emails, 'Response Required', emailFields);
      });
      res.status(201).json(newExemption);
    } catch (error) {
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

    let updated;
    try {
      await db.transaction().execute(async (trx) => {
        await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);
        const existing = await trx
          .selectFrom(TABLE)
          .selectAll()
          .where('id', '=', exemptionId)
          .where('agreement_id', '=', agreementId)
          .executeTakeFirst();
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
            if (
              existing.status === EXEMPTION_STATUS.PENDING_APPROVAL ||
              existing.status === EXEMPTION_STATUS.APPROVED
            ) {
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

        updated = await trx
          .updateTable(TABLE)
          .set(updateData)
          .where('id', '=', exemptionId)
          .returningAll()
          .executeTakeFirst();
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
          const existingAttachments = await trx
            .selectFrom('exemption_attachment')
            .selectAll()
            .where('exemption_id', '=', exemptionId)
            .execute();

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
            await trx
              .deleteFrom('exemption_attachment')
              .where(
                'id',
                'in',
                attachmentsToDelete.map((a) => a.id),
              )
              .execute();
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
              throw errorWithCode('Each attachment must include name and url', 400);
            }
            const att = await trx
              .insertInto('exemption_attachment')
              .values({ name, url, type, access, exemption_id: exemptionId, user_id: user.id })
              .returningAll()
              .executeTakeFirst();
            createdAttachments.push(att);
          }

          // Fetch all current attachments (existing + newly created)
          updated.attachments = await trx
            .selectFrom('exemption_attachment')
            .selectAll()
            .where('exemption_id', '=', exemptionId)
            .execute();
        }

        await updateAgreementExemptions(trx, user, agreementId);
      });

      res.status(200).json(updated);
    } catch (error) {
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

    try {
      await db.transaction().execute(async (trx) => {
        await PlanRouteHelper.canUserAccessThisAgreement(trx, Agreement, user, agreementId);
        const existing = await trx
          .selectFrom(TABLE)
          .selectAll()
          .where('id', '=', exemptionId)
          .where('agreement_id', '=', agreementId)
          .executeTakeFirst();
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
        await trx.deleteFrom(TABLE).where('id', '=', exemptionId).execute();
        // Record status transition history for deletion
        await ExemptionStatusHistory.create(trx, {
          exemption_id: exemptionId,
          from_status: existing.status,
          to_status: EXEMPTION_STATUS.DELETED,
          note: 'Deleted',
          user_id: user.id,
        });
        await updateAgreementExemptions(trx, user, agreementId);
      });
      res.status(204).send();
    } catch (error) {
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

    if (agreement) {
      await agreement.fetchClients();
      exemption.agreement = agreement;
    }
    const response = await generateExemptionPDF(exemption);
    if (!response.data) {
      logger.error('Exemption PDF generation returned empty data — CDOGS may be disabled or template missing');
      throw errorWithCode('Failed to generate PDF', 500);
    }
    res.setHeader('Content-disposition', `attachment; filename=${exemption.agreementId}_Exemption${exemptionId}.pdf`);
    res.setHeader('Content-type', 'application/pdf');
    res.send(response.data);
  }

  static async prepareEmailAttachments(exemption, attachments) {
    const emailAttachments = [];

    // 1. Generated PDF
    try {
      const agreement = await Agreement.findById(db, exemption.agreementId);

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
