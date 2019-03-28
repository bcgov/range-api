import { logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
import { MINISTER_ISSUE_ACTION_TYPE } from '../../constants';
import DataManager from '../../libs/db2';
import config from '../../config';
import { PlanRouteHelper } from '../helpers';

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
    const { planId, issueId } = params;
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

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const data = {
        detail,
        action_type_id: actionTypeId,
        issue_id: issueId,
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
    const { planId, actionId } = params;
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

      const updatedAction = await MinisterIssueAction.update(
        db,
        { id: actionId },
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
    const { planId, actionId } = params;

    checkRequiredFields(
      ['planId', 'issueId', 'actionId'], 'params', req,
    );

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, user, agreementId);

      const results = await MinisterIssueAction.removeById(db, actionId);

      return res.status(204).json({
        success: (results.length > 0),
      }).end();
    } catch (error) {
      logger.error(`PlanMinisterIssueActionController: destroy: fail with error: ${error.message}`);
      throw error;
    }
  }
}
