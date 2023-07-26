import { errorWithCode } from '@bcgov/nodejs-common-utils';
import DataManager from '../../libs/db2';
import config from '../../config';

const dm = new DataManager(config);
const {
  db,
  EmailTemplate,
} = dm;

export class EmailTemplateController {
  // Fetching all emailTemplates
  static async allEmailTemplate(req, res) {
    try {
      const { user, query } = req;
      const { orderCId, excludeBy: eBy, exclude: e } = query;

      if (user && user.isAgreementHolder()) {
        throw errorWithCode('You do not have the permission as an agreement holder', 403);
      }

      let order = [];
      if (orderCId) {
        order = ['id', orderCId];
      }

      let exclude;
      if (eBy && e) {
        exclude = [eBy, 'ilike', `%${e}%`];
      }
      console.log(exclude + ' ' + order)
      const emailTemplates = await EmailTemplate.findWithExclusion(db, {}, order, exclude);

      res.status(200).json(emailTemplates).end();
      return;
    } catch (error) {
      throw error;
    }
  }

  static async updateMe(req, res) {
    try {
      const { 'body': reqBody, user, params } = req;
      const { templateId } = params;
      const {
        name,
        fromEmail,
        subject,
        body,
      } = reqBody;

      if (user && user.isAgreementHolder()) {
        throw errorWithCode('You do not have the permission as an agreement holder', 403);
      }
      const updated = await EmailTemplate.update(db, { id: templateId }, {
        name,
        fromEmail,
        subject,
        body,
      });

      res.status(200).json(updated).end();
    } catch (error) {
      throw error;
    }
  }
}

const emailTemplateController = new EmailTemplateController();

export default emailTemplateController;
