import { logger } from '@bcgov/nodejs-common-utils';
import { substituteFields } from '../../libs/utils';
import { Mailer } from '../../libs/mailer';
import Agreement from '../../libs/db2/model/agreement';
import Client from '../../libs/db2/model/client';
import User from '../../libs/db2/model/user';
import EmailTemplate from '../../libs/db2/model/emailtemplate';
import Zone from '../../libs/db2/model/zone';
import { SSO_ROLE_MAP } from '../../constants';

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
        .table('user_account')
        .join('user_districts', 'user_districts.user_id', '=', 'user_account.id')
        .where('user_districts.id', zone.districtId)
        .andWhere('user_account.role_id', 2)
        .select('user_account.email');

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
