//
// SecureImage
//
// Copyright © 2018 Province of British Columbia
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Created by Jason Leach on 2018-01-18.
//

/* eslint-env es6 */

'use strict';

import { asyncMiddleware, errorWithCode } from '@bcgov/nodejs-common-utils';
import { Router } from 'express';
import config from '../../config';
import DataManager from '../../libs/db2';
import { checkRequiredFields } from '../../libs/utils';
import { MINISTER_ISSUE_ACTION_TYPE } from '../../constants';

/**
 * Controller for individual routes
 */
import PlanController from '../controllers/PlanController';
import PlanStatusController from '../controllers/PlanStatusController';
import PlanPastureController from '../controllers/PlanPastureController';
import PlanScheduleController from '../controllers/PlanScheduleController';
import PlanMinisterIssueController from '../controllers/PlanMinisterIssueController';

const router = new Router();

const dm = new DataManager(config);
const {
  db,
  Plan,
  Agreement,
  MinisterIssueAction,
  MinisterIssueActionType,
  InvasivePlantChecklist,
  AdditionalRequirement,
  ManagementConsideration,
} = dm;

const canUserAccessThisAgreement = async (user, agreementId) => {
  if (!agreementId) {
    throw errorWithCode('Unable to find a plan');
  }

  const [agreement] = await Agreement.find(db, { forest_file_id: agreementId });
  if (!agreement) {
    throw errorWithCode('Unable to find the related agreement');
  }

  const can = await user.canAccessAgreement(db, agreement);
  if (!can) {
    throw errorWithCode('You do not access to this agreement', 403);
  }
};

// Get a specific plan.
router.get('/:planId?', asyncMiddleware(PlanController.show));

// Create a new plan.
router.post('/', asyncMiddleware(PlanController.store));

// Update an existing plan
router.put('/:planId?', asyncMiddleware(PlanController.update));

// Update the status of an existing plan.
router.put('/:planId?/status', asyncMiddleware(PlanStatusController.update));

// update existing amendment confirmation
router.put('/:planId?/confirmation/:confirmationId?', asyncMiddleware(PlanStatusController.updateAmendment));

// create a plan status history
router.post('/:planId?/status-record', asyncMiddleware(PlanStatusController.storeStatusHistory));

//
// Pasture
//

// Add a Pasture to an existing Plan
router.post('/:planId?/pasture', asyncMiddleware(PlanPastureController.store));

// Update the existing Pasture of an existing Plan
router.put('/:planId?/pasture/:pastureId?', asyncMiddleware(PlanPastureController.update));

// create a plant community
router.post('/:planId?/pasture/:pastureId?/plant-community', asyncMiddleware(PlanPastureController.storePlatCommunity));

// create a plant community action
router.post('/:planId?/pasture/:pastureId?/plant-community/:communityId/action', asyncMiddleware(PlanPastureController.storePlantCommunityAction));

// create a indicator plant
router.post('/:planId?/pasture/:pastureId?/plant-community/:communityId/indicator-plant',
  asyncMiddleware(PlanPastureController.storeIndicatorPlant));

// create a monitoring area
router.post('/:planId?/pasture/:pastureId?/plant-community/:communityId/monitoring-area',
  asyncMiddleware(PlanPastureController.storeMonitoringArea));

//
// Schedule
//

// Add a Schedule (and related Grazing Schedule Entries) to an existing Plan
router.post('/:planId?/schedule', asyncMiddleware(PlanScheduleController.store));

// Update an existing Schedule (and related Grazing Schedule Entries) of an existing Plan
router.put('/:planId?/schedule/:scheduleId?', asyncMiddleware(PlanScheduleController.update));

// Remove a Schedule (and related Grazing Schedule Entries) from an existing Plan
router.delete('/:planId?/schedule/:scheduleId?', asyncMiddleware(PlanScheduleController.destroy));

// Add a grazing schedule entry to an existing grazing schedule
router.post('/:planId?/schedule/:scheduleId?/entry', asyncMiddleware(PlanScheduleController.storeScheduleEntry));

// Remove a Grazing Schedule Entries from Grazing Schedule
router.delete('/:planId?/schedule/:scheduleId?/entry/:grazingScheduleEntryId?',
  asyncMiddleware(PlanScheduleController.destroyScheduleEntry));

//
// Minister Issues
//

// Add a Minister Issue to an existing Plan
router.post('/:planId?/issue', asyncMiddleware(PlanMinisterIssueController.store));

// Update a Minister Issue to an existing Plan
router.put('/:planId?/issue/:issueId?', asyncMiddleware(PlanMinisterIssueController.update));

// Remove a Minister Issue from an existing Plan
router.delete('/:planId?/issue/:issueId?', asyncMiddleware(PlanMinisterIssueController.destroy));

//
// Minister Issue Action
//

// Add a Minister Issue Action to an existing Minister Issue
router.post('/:planId?/issue/:issueId?/action', asyncMiddleware(async (req, res) => {
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
    await canUserAccessThisAgreement(user, agreementId);

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
    throw error;
  }
}));

// Update a Minister Issue Action to an existing Minister Issue
router.put('/:planId?/issue/:issueId?/action/:actionId', asyncMiddleware(async (req, res) => {
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
    await canUserAccessThisAgreement(user, agreementId);

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
    throw error;
  }
}));

// Delete a Minister Issue Action
router.delete('/:planId?/issue/:issueId?/action/:actionId', asyncMiddleware(async (req, res) => {
  const { params, user } = req;
  const { planId, actionId } = params;

  checkRequiredFields(
    ['planId', 'issueId', 'actionId'], 'params', req,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

    const result = await MinisterIssueAction.removeById(db, actionId);
    if (result === 0) {
      throw errorWithCode('No such minister issue action exists', 400);
    }

    return res.status(204).json().end();
  } catch (error) {
    throw error;
  }
}));

// create an invasive plant checklist
router.post('/:planId?/invasive-plant-checklist', asyncMiddleware(async (req, res) => {
  const { body, params, user } = req;
  const { planId } = params;

  checkRequiredFields(
    ['planId'], 'params', req,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

    const ipcl = await InvasivePlantChecklist.findOne(db, { plan_id: planId });
    if (ipcl) {
      throw errorWithCode(`Invasive plant checklist already exist with the plan id ${planId}`);
    }

    const checklist = await InvasivePlantChecklist.create(db, { ...body, plan_id: planId });
    return res.status(200).json(checklist).end();
  } catch (error) {
    throw error;
  }
}));

// update an invasive plant checklist
router.put('/:planId?/invasive-plant-checklist/:checklistId?', asyncMiddleware(async (req, res) => {
  const { body, params, user } = req;
  const { planId } = params;

  checkRequiredFields(
    ['planId', 'checklistId'], 'params', req,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

    const updatedChecklist = await InvasivePlantChecklist.update(
      db,
      { plan_id: planId },
      body,
    );

    return res.status(200).json(updatedChecklist).end();
  } catch (error) {
    throw error;
  }
}));

// create an additonal requirement
router.post('/:planId?/additional-requirement', asyncMiddleware(async (req, res) => {
  const { body, params, user } = req;
  const { planId } = params;

  checkRequiredFields(
    ['planId'], 'params', req,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

    const requirement = await AdditionalRequirement.create(db, { ...body, plan_id: planId });
    return res.status(200).json(requirement).end();
  } catch (error) {
    throw error;
  }
}));

// create a management consideration
router.post('/:planId?/management-consideration', asyncMiddleware(async (req, res) => {
  const { body, params, user } = req;
  const { planId } = params;

  checkRequiredFields(
    ['planId'], 'params', req,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

    const consideration = await ManagementConsideration.create(db, { ...body, plan_id: planId });

    return res.status(200).json(consideration).end();
  } catch (error) {
    throw error;
  }
}));

// update a management consideration
router.put('/:planId?/management-consideration/:considerationId?', asyncMiddleware(async (req, res) => {
  const { body, params, user } = req;
  const { planId, considerationId } = params;

  checkRequiredFields(
    ['planId', 'considerationId'], 'params', req,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

    const updated = await ManagementConsideration.update(
      db,
      { id: considerationId },
      { ...body, plan_id: planId },
    );

    return res.status(200).json(updated).end();
  } catch (error) {
    throw error;
  }
}));

// delete a management consideration
router.delete('/:planId?/management-consideration/:considerationId?', asyncMiddleware(async (req, res) => {
  const { params, user } = req;
  const { planId, considerationId } = params;

  checkRequiredFields(
    ['planId', 'considerationId'], 'params', req,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

    const result = await ManagementConsideration.removeById(db, considerationId);
    if (result === 0) {
      throw errorWithCode('No such management consideration exists', 400);
    }

    return res.status(204).end();
  } catch (error) {
    throw error;
  }
}));

module.exports = router;
