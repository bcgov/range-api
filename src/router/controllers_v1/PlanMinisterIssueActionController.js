import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
import { MINISTER_ISSUE_ACTION_TYPE } from '../../constants';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';
import MinisterIssue from '../../libs/db2/model/ministerissue';

const dm = new DataManager(config);
const {
  db,
  Agreement,
  Plan,
  MinisterIssueActionType,
  MinisterIssueAction,
} = dm;

export default class PlanMinisterIssueActionController {
  /**
   * Add a Minister Issue Action to an existing Minister Issue
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async store(req, res) {
    const { body, params, user } = req;
    const { planId: canonicalId, issueId } = params;
    const {
      actionTypeId,
      detail,
      other,
      noGrazeEndDay,
      noGrazeEndMonth,
      noGrazeStartDay,
      noGrazeStartMonth,
    } = body;

    checkRequiredFields(
      ['planId', 'issueId'], 'params', req,
    );

    checkRequiredFields(
      ['actionTypeId'], 'body', req,
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

      const issue = await MinisterIssue.findOne(db, { canonical_id: issueId, plan_id: planId });
      if (!issue) {
        throw errorWithCode("Minister issue doesn't exist", 500);
      }

      const data = {
        detail,
        action_type_id: actionTypeId,
        issue_id: issue.id,
        other: null,
        no_graze_start_day: null,
        no_graze_start_month: null,
        no_graze_end_day: null,
        no_graze_end_month: null,
      };

      const actionTypes = await MinisterIssueActionType.find(db, { active: true });
      const actionType = actionTypes.find(at => at.id === actionTypeId);
      if (actionType && actionType.name === MINISTER_ISSUE_ACTION_TYPE.OTHER) {
        data.other = other;
      }

      if (actionType && actionType.name === MINISTER_ISSUE_ACTION_TYPE.TIMING) {
        data.no_graze_start_day = noGrazeStartDay;
        data.no_graze_start_month = noGrazeStartMonth;
        data.no_graze_end_day = noGrazeEndDay;
        data.no_graze_end_month = noGrazeEndMonth;
      }

      const action = await MinisterIssueAction.create(
        db,
        data,
      );
      return res.status(200).json(action).end();
    } catch (error) {
      logger.error(`PlanMinisterIssueActionController: store: fail with error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a Minister Issue Action to an existing Minister Issue
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async update(req, res) {
    const { body, params, user } = req;
    const { planId: canonicalId, issueId, actionId } = params;
    const {
      actionTypeId,
      detail,
      other,
      noGrazeEndDay,
      noGrazeEndMonth,
      noGrazeStartDay,
      noGrazeStartMonth,
    } = body;

    checkRequiredFields(
      ['planId', 'issueId', 'actionId'], 'params', req,
    );

    checkRequiredFields(
      ['actionTypeId'], 'body', req,
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

      const data = {
        detail,
        actionTypeId,
        other: null,
        no_graze_start_day: null,
        no_graze_start_month: null,
        no_graze_end_day: null,
        no_graze_end_month: null,
      };

      const actionTypes = await MinisterIssueActionType.find(db, { active: true });
      const actionType = actionTypes.find(at => at.id === actionTypeId);
      if (actionType && actionType.name === MINISTER_ISSUE_ACTION_TYPE.OTHER) {
        data.other = other;
      }
      if (actionType && actionType.name === MINISTER_ISSUE_ACTION_TYPE.TIMING) {
        data.no_graze_start_day = noGrazeStartDay;
        data.no_graze_start_month = noGrazeStartMonth;
        data.no_graze_end_day = noGrazeEndDay;
        data.no_graze_end_month = noGrazeEndMonth;
      }

      const issue = await MinisterIssue.findOne(db, { canonical_id: issueId, plan_id: planId });

      const updatedAction = await MinisterIssueAction.update(
        db,
        { canonical_id: actionId, issue_id: issue.id },
        data,
      );

      return res.status(200).json(updatedAction).end();
    } catch (error) {
      logger.error(`PlanMinisterIssueActionController: update: fail with error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a Minister Issue Action
   * @param {*} req : express req
   * @param {*} res : express res
   */
  static async destroy(req, res) {
    const { params, user } = req;
    const { planId: canonicalId, issueId, actionId } = params;

    checkRequiredFields(
      ['planId', 'issueId', 'actionId'], 'params', req,
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

      const issue = await MinisterIssue.findOne(db, { canonical_id: issueId, plan_id: planId });

      const results = await MinisterIssueAction.remove(
        db,
        { canonical_id: actionId, issue_id: issue.id },
      );

      return res.status(204).json({
        success: (results.length > 0),
      }).end();
    } catch (error) {
      logger.error(`PlanMinisterIssueActionController: destroy: fail with error: ${error.message}`);
      throw error;
    }
  }
}
