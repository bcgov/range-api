// @ts-nocheck
import { logger } from '../../libs/bcgov-shim.js';
import { substituteFields } from '../../libs/utils.js';
import { Mailer } from '../../libs/mailer.js';
import Agreement from '../../libs/db2/model/agreement.js';
import Client from '../../libs/db2/model/client.js';
import User from '../../libs/db2/model/user.js';
import EmailTemplate from '../../libs/db2/model/emailtemplate.js';
import Zone from '../../libs/db2/model/zone.js';
import { SSO_ROLE_MAP } from '../../constants.js';

export default class NotificationHelper {
  static async getParticipants(db, agreementId, excludedUsers = []) {
    const emails = [];

    const [agreement] = await Agreement.find(db, { forest_file_id: agreementId });
    const zone = await Zone.findById(db, agreement.zoneId);

    // Add range officer if not excluded
    if (!excludedUsers.includes(SSO_ROLE_MAP.RANGE_OFFICER)) {
      const rangeOfficer = await User.findById(db, zone.userId);
      if (rangeOfficer && rangeOfficer.email) {
        emails.push(rangeOfficer.email);
      }
    }

    // Add district managers for the agreement's district if not excluded
    if (!excludedUsers.includes(SSO_ROLE_MAP.DECISION_MAKER) && zone.districtId) {
      const districtManagers = await db
        .selectFrom('user_account')
        .innerJoin('user_districts', 'user_districts.user_id', 'user_account.id')
        .where('user_districts.id', '=', zone.districtId)
        .where('user_account.role_id', '=', 2)
        .select('user_account.email')
        .execute();

      for (const manager of districtManagers) {
        if (manager.email) {
          emails.push(manager.email);
        }
      }
    }

    // Add agreement holders (clients) if not excluded
    if (!excludedUsers.includes(SSO_ROLE_MAP.AGREEMENT_HOLDER)) {
      const clients = await Client.clientsForAgreement(db, {
        forestFileId: agreementId,
      });

      for (const client of clients) {
        const user = await User.fromClientId(db, client.clientNumber);
        if (user && user.email) {
          emails.push(user.email);
        }
      }
    }

    // Add agents if not excluded
    if (!excludedUsers.includes('agent') && !excludedUsers.includes(SSO_ROLE_MAP.AGREEMENT_HOLDER)) {
      const agents = await User.getAgentsFromAgreementId(db, agreementId);
      const agentEmails = [...new Set(agents.map((agent) => agent.email))];
      for (const agentEmail of agentEmails) {
        if (agentEmail) {
          emails.push(agentEmail);
        }
      }
    }

    return {
      emails: [...new Set(emails)],
    };
  }

  static async sendEmail(db, emails, templateName, emailFields, attachments = []) {
    try {
      if (!emails || emails.length === 0) {
        logger.info(`No recipients for email template: ${templateName}`);
        return;
      }

      const templates = await EmailTemplate.findWithExclusion(db, {
        name: templateName,
      });
      const template = templates[0];
      if (!template) {
        throw new Error(`Email template ${templateName} not found`);
      }

      const mailer = new Mailer();
      await mailer.sendEmail(
        emails,
        template.fromEmail,
        substituteFields(template.subject, emailFields),
        substituteFields(template.body, emailFields),
        'html',
        attachments,
      );
    } catch (err) {
      logger.error(`Error sending email: ${err.message}`);
      throw err;
    }
  }
}
