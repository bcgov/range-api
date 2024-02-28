import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import axios from 'axios';
import fs from 'fs';

export default class Cdogs {
  constructor(
    authenticaitonURL = process.env.CDOGS_AUTHENTICATION_URL,
    serviceURL = process.env.CDOGS_SERVICE_URL,
    clientId = process.env.CDOGS_CLIENT_ID,
    clientSecret = process.env.CDOGS_CLIENT_SECRET,
    enabled = process.env.CDOGS_ENABLED,
  ) {
    this.authenticationURL = authenticaitonURL;
    this.serviceURL = serviceURL;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.enabled = enabled;
  }

  async init() {
    this.template = {
      encodingType: 'base64',
      fileType: 'docx',
      content: await Cdogs.readTemplate(),
    };
    this.options = {
      cacheReport: false,
      convertTo: 'pdf',
      overwrite: true,
    };
  }

  async getBearerToken() {
    const tokenEndpoint = `${this.authenticationURL}/auth/realms/comsvcauth/protocol/openid-connect/token`;
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');
    try {
      const response = await axios.post(
        tokenEndpoint,
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );
      logger.debug('Bearer token retrieved');
      return response.data.access_token;
    } catch (error) {
      logger.error(`Failed to retrieve bearer token: ${JSON.stringify(error)}`);
      throw errorWithCode(
        `Failed to retrieve bearer token ${JSON.stringify(error)}`,
        500,
      );
    }
  }

  async generatePDF(planData) {
    if (!this.enabled.toLowerCase() === 'true') return {};
    const serviceURL = `${this.serviceURL}/api/v2/template/render`;
    try {
      const token = await this.getBearerToken();
      const payload = {
        data: planData,
        options: { ...this.options, reportName: `${planData.agreementId}.pdf` },
        template: this.template,
      };
      const response = await axios.post(serviceURL, JSON.stringify(payload), {
        timeout: 30000,
        responseType: 'arraybuffer',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return response;
    } catch (error) {
      logger.error(
        `Error generating PDF file: ${JSON.stringify(error.message)}`,
      );
      throw errorWithCode(
        `Error generating PDF file: ${JSON.stringify(error.message)}`,
        500,
      );
    }
  }

  static async readTemplate(template = './planTemplate.docx') {
    try {
      const data = fs.readFileSync(template);
      return Buffer.from(data).toString('base64');
    } catch (error) {
      logger.error(
        `Error reading template file ${template}: ${JSON.stringify(error)}`,
      );
      throw errorWithCode(
        `Error reading template file ${template}: ${JSON.stringify(error)}`,
        500,
      );
    }
  }
}
