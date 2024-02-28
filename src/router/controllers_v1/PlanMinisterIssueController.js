import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import assert from 'assert';
import { flatten } from 'lodash';
import { checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';
import Pasture from '../../libs/db2/model/pasture';

const dm = new DataManager(config);
const { db, Agreement, Plan, MinisterIssue, MinisterIssuePasture } = dm;

export default class PlanMinisterIssueController {
  /**
   * Helpers
   */
  // --------------------------------------------------
  /**
   * Validating Minister issue operation
   * @param {*} planId : string
   * @param {*} body : object
   */
  static async validateMinisterIssueOperation(planId, body) {
    const { pastures } = body;

    assert(planId, 'validateMinisterIssueOperation: require plan:id');
    assert(body, 'validateMinisterIssueOperation: require body');

    if (!pastures) {
      return;
    }

    try {
      // if there are pastures, make sure the all the pastures
      // associated to the issue belong to the current plan.
      const plan = await Plan.findById(db, planId);
      await plan.fetchPastures();
      const okPastureIds = plan.pastures.map((pasture) => pasture.id);
      const status = pastures.every((i) => okPastureIds.includes(i));
      if (!status) {
        throw errorWithCode(
          'Some pastures do not belong to the current user ',
          400,
        );
      }
    } catch (error) {
      logger.error(
        `PlanMinisterIssueController: validateMinisterIssueOperation: fail with error: ${error.message}`,
      );
      throw errorWithCode('Unable to confirm Plan ownership', 500);
    }
  }

  /**
   * SanitizeData For Minister Issue
   * @param {*} body : object
   * @return object
   */
  static sanitizeDataForMinisterIssue(body) {
    assert(body, 'sanitizeDataForMinisterIssue: require body');
    /* eslint-disable no-param-reassign */
    // Use the planId from the URL so that we know exactly what plan
    // is being updated and to ensure its not reassigned.
    delete body.planId;
    delete body.plan_id;
    /* eslint-enable no-param-reassign */

    return body;
  }

  static async validate(user, planId, body) {
    const agreementId = await Plan.agreementIdForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(
      db,
      Agreement,
      user,
      agreementId,
    );
    await PlanMinisterIssueController.validateMinisterIssueOperation(
      planId,
      body,
    );
    const data = PlanMinisterIssueController.sanitizeDataForMinisterIssue(body);
    return data;
  }
  // End Helpers
  // -----------------------------------------

  /**
   * Route methods
   */
  // ------------------------------------------
  /**
   * Add a Minister Issue to an existing Plan
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async store(req, res) {
    const { body, params, user } = req;
    const { planId } = params;
    const { pastures } = body;

    checkRequiredFields(['planId'], 'params', req);

    try {
      const data = await PlanMinisterIssueController.validate(
        user,
        planId,
        body,
      );
      const issue = await MinisterIssue.create(db, {
        ...data,
        ...{ plan_id: planId },
      });
      const promises =
        pastures &&
        pastures.map(async (id) => {
          await MinisterIssuePasture.create(db, {
            pasture_id: id,
            minister_issue_id: issue.id,
          });
        });
      if (promises) await Promise.all(promises);

      return res
        .status(200)
        .json({ ...issue, pastures })
        .end();
    } catch (error) {
      logger.error(
        `PlanMinisterIssueController: store: fail with error: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Update a Minister Issue to an existing Plan
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async update(req, res) {
    const { body, params, user } = req;
    const { planId, issueId } = params;
    const { pastures } = body;

    checkRequiredFields(['planId', 'issueId'], 'params', req);

    try {
      // Validating data
      const data = await PlanMinisterIssueController.validate(
        user,
        planId,
        body,
      );

      // update the existing issue.
      const issue = await MinisterIssue.update(db, { id: issueId }, data);

      // Get existing pastures for minister issue
      const issuePastures = await Promise.all(
        (
          await MinisterIssuePasture.find(db, {
            minister_issue_id: issue.id,
          })
        ).map(async (issuePasture) => ({
          ...issuePasture,
          pasture: await Pasture.findById(db, issuePasture.pastureId),
        })),
      );
      const flatIssuePastures = flatten(issuePastures);

      const removedPastures = flatIssuePastures.filter(
        (p) => !pastures.includes(p.pasture.id),
      );
      const newPastures = pastures.filter(
        (pId) => !flatIssuePastures.find((p) => p.pasture.id === pId),
      );

      // Remove pastures not present in updated pastures array
      await Promise.all(
        removedPastures.map((item) =>
          MinisterIssuePasture.removeById(db, item.id),
        ),
      );

      // Add new pastures provided in request body
      await Promise.all(
        newPastures.map(async (id) =>
          MinisterIssuePasture.create(db, {
            pasture_id: id,
            minister_issue_id: issue.id,
          }),
        ),
      );

      return res
        .status(200)
        .json({ ...issue, pastures })
        .end();
    } catch (error) {
      logger.error(
        `PlanMinisterIssueController: update: fail with error: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Remove a Minister Issue from an existing Plan
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async destroy(req, res) {
    const { params, user } = req;
    const { planId, issueId } = params;

    checkRequiredFields(['planId', 'issueId'], 'params', req);

    try {
      const agreementId = await Plan.agreementIdForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(
        db,
        Agreement,
        user,
        agreementId,
      );
      const results = await MinisterIssue.removeById(db, issueId);
      return res
        .status(204)
        .json({ success: results.length > 0 })
        .end();
    } catch (error) {
      logger.error(
        `PlanMinisterIssueController: destroy: fail with error: ${error.message}`,
      );
      throw error;
    }
  }
}
