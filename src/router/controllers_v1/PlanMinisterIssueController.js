import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import assert from 'assert';
import { flatten } from 'lodash';
import { checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';

const dm = new DataManager(config);
const {
  db,
  Agreement,
  Plan,
  MinisterIssue,
  MinisterIssuePasture,
} = dm;

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
      const okPastureIds = plan.pastures.map(pasture => pasture.canonicalId);
      const status = pastures.every(i => okPastureIds.includes(i));
      if (!status) {
        throw errorWithCode('Some pastures do not belong to the current user ', 400);
      }
    } catch (error) {
      logger.error(`PlanMinisterIssueController: validateMinisterIssueOperation: fail with error: ${error.message}`);
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
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
    await PlanMinisterIssueController.validateMinisterIssueOperation(planId, body);
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
    const { planId: canonicalId } = params;
    const { pastures } = body;

    checkRequiredFields(
      ['planId'], 'params', req,
    );

    if (!canonicalId) {
      throw errorWithCode('planId must be provided in path', 404);
    }

    const currentPlan = await Plan.findCurrentVersion(db, canonicalId);

    if (!currentPlan) {
      throw errorWithCode('Plan doesn\'t exist', 500);
    }

    const planId = currentPlan.id;

    try {
      const data = await PlanMinisterIssueController.validate(user, planId, body);
      const issue = await MinisterIssue.create(db, { ...data, ...{ plan_id: planId } });
      const promises = pastures && pastures.map(id =>
        MinisterIssuePasture.create(db, { pasture_id: id, minister_issue_id: issue.id }));
      if (promises) await Promise.all(promises);

      const { canonicalId: issueCanonicalId, ...createdIssue } = {
        ...issue,
        pastures,
      };

      return res.status(200).json({ ...createdIssue, id: issueCanonicalId }).end();
    } catch (error) {
      logger.error(`PlanMinisterIssueController: store: fail with error: ${error.message}`);
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
    const { planId: canonicalId, issueId } = params;
    const { pastures } = body;

    checkRequiredFields(
      ['planId', 'issueId'], 'params', req,
    );

    if (!canonicalId) {
      throw errorWithCode('planId must be provided in path', 400);
    }

    const currentPlan = await Plan.findCurrentVersion(db, canonicalId);

    if (!currentPlan) {
      throw errorWithCode('Plan doesn\'t exist', 404);
    }

    const planId = currentPlan.id;

    try {
      // Validating data
      const data = await PlanMinisterIssueController.validate(user, planId, body);

      // update the existing issue.
      const issue = await MinisterIssue.update(
        db,
        { canonical_id: issueId, plan_id: planId },
        data,
      );

      // remove the existing link between the issue and it's related pastures.
      const issuePastures = await Promise.all(pastures.map(id =>
        MinisterIssuePasture.find(db, { pasture_id: id, minister_issue_id: issue.id })));
      const flatIssuePastures = flatten(issuePastures);

      await Promise.all(flatIssuePastures.map(item =>
        MinisterIssuePasture.removeById(db, item.id)));

      // build the new relation between the issue and it's pastures.
      await Promise.all(pastures.map(id =>
        MinisterIssuePasture.create(db, { pasture_id: id, minister_issue_id: issue.id })));

      const { canonicalId: issueCanonicalId, ...updatedIssue } = {
        ...issue,
        pastures,
      };

      return res.status(200).json({ ...updatedIssue, id: issueCanonicalId }).end();
    } catch (error) {
      logger.error(`PlanMinisterIssueController: update: fail with error: ${error.message}`);
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
    const { planId: canonicalId, issueId } = params;

    checkRequiredFields(
      ['planId', 'issueId'], 'params', req,
    );

    if (!canonicalId) {
      throw errorWithCode('planId must be provided in path', 400);
    }

    const currentPlan = await Plan.findCurrentVersion(db, canonicalId);

    if (!currentPlan) {
      throw errorWithCode('Plan doesn\'t exist', 404);
    }

    const planId = currentPlan.id;

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);
      const results = await MinisterIssue.remove(db, { canonical_id: issueId, plan_id: planId });
      return res.status(204).json({ success: (results.length > 0) }).end();
    } catch (error) {
      logger.error(`PlanMinisterIssueController: destroy: fail with error: ${error.message}`);
      throw error;
    }
  }
}
