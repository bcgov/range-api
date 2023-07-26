import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import axios from "axios";

export class Mailer {

  constructor(authenticaitonURL = process.env.CHES_AUTHENTICATION_URL, emailServiceURL = process.env.CHES_EMAIL_SERVICE_URL, clientId = process.env.CHES_CLIENT_ID, clientSecret = process.env.CHES_CLIENT_SECRET, enabled = process.env.CHES_ENABLED) {
    this.authenticationURL = authenticaitonURL;
    this.emailServiceURL = emailServiceURL;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.enabled = enabled;
  }

  async getBearerToken() {
    const tokenEndpoint = `${this.authenticationURL}/auth/realms/comsvcauth/protocol/openid-connect/token`
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
    try {
      const response = await axios.post(tokenEndpoint, 'grant_type=client_credentials', {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });
      console.debug("Bearer token retrieved")
      return response.data.access_token
    }
    catch (error) {
      logger.error(`Failed to retrieve bearer token: ${JSON.stringify(error)}`)
      throw errorWithCode('Failed to retrieve bearer token', 500)
    }
  }

  async sendEmail(to, from, subject, body, bodyType) {
    if (!eval(this.enabled))
      return;
    const emailEndpoint = `${this.emailServiceURL}/api/v1/email`
    try {
      const token = await this.getBearerToken()
      const emailPayload = { to, from, subject, body, bodyType, }
      logger.debug("email payload: " + JSON.stringify(emailPayload)) 
      await axios.post(emailEndpoint, JSON.stringify(emailPayload), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }).then(response => {
        if (response.status > 199 && response.status < 300)
          logger.info('Email sent successfully')
        else
          logger.error(`Could not send Email: ${response.statusText}`)
      }).catch(error => {
        logger.error(`Error sending email: ${JSON.stringify(error)}`)
        throw errorWithCode('Error sending email', 500)
      });
    } catch (error) {
      logger.error(`Failed sending email: ${JSON.stringify(error)}`)
      throw errorWithCode('Failed sending email', 500)
    }
  }
}