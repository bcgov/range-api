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

import { asyncMiddleware, errorWithCode, logger } from '@bcgov/common-nodejs';
import { Router } from 'express';
import { flatten } from 'lodash';
import config from '../../config';
import DataManager from '../../libs/db2';
import { isNumeric } from '../../libs/utils';

const router = new Router();

const dm = new DataManager(config);
const {
  db,
  Pasture,
  Plan,
  Agreement,
  PlanStatus,
  GrazingSchedule,
  GrazingScheduleEntry,
  MinisterIssue,
  MinisterIssuePasture,
  MinisterIssueAction,
} = dm;

const userCanAccessAgreement = async (user, agreementId) => {
  const agreements = await Agreement.find(db, { forest_file_id: agreementId });
  if (agreements.length === 0) {
    throw errorWithCode('Unable to find the related agreement', 500);
  }

  const agreement = agreements.pop();

  if (!user.canAccessAgreement(agreement)) {
    return false;
  }

  return true;
};

// Get a specific plan.
router.get('/:planId', asyncMiddleware(async (req, res) => {
  const {
    planId,
  } = req.params;

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    if (!userCanAccessAgreement(req.user, agreementId)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    const results = await Agreement.findWithAllRelations(db, { forest_file_id: agreementId });
    const myAgreement = results.pop();
    myAgreement.transformToV1();

    // TODO:(jl) This should return the Plan, not the agreement with the embeded
    // plan.

    const plans = myAgreement.plans.filter(p => p.id === Number(planId));
    delete myAgreement.plans;
    myAgreement.plan = plans.pop();

    await myAgreement.plan.fetchPastures();
    await myAgreement.plan.fetchGrazingSchedules();
    await myAgreement.plan.fetchMinisterIssues();

    return res.status(200).json(myAgreement).end();
  } catch (error) {
    logger.error(`Unable to fetch plan, error = ${error.message}`);
    throw errorWithCode('There was a problem fetching the record', 500);
  }
}));

// Create a new plan.
router.post('/', asyncMiddleware(async (req, res) => {
  const {
    body,
  } = req;
  const {
    agreementId,
    statusId,
  } = body;

  try {
    if (!userCanAccessAgreement(req.user, agreementId)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    const agreement = await Agreement.findById(db, agreementId);
    if (!agreement) {
      throw errorWithCode('agreement not found', 404);
    }

    if (body.id || body.planId) {
      const plan = await Plan.findById(db, body.id || body.planId);
      if (plan) {
        throw errorWithCode('A plan with this ID exists. Use PUT.', 409);
      }
    }

    // delete the old plan whose status is 'Staff Draft' when saving the new staff draft plan.
    const staffDraftStatus = await PlanStatus.findOne(db, {
      code: 'SD',
    });
    if (staffDraftStatus && (statusId === staffDraftStatus.id)) {
      await Plan.remove(db, {
        agreement_id: agreement.id,
        status_id: staffDraftStatus.id,
      });
    }

    // business logic to prevent from creating a plan when the lastest one is in progress
    // const [latestPlan] = await Plan
    //   .findLatestWithStatusExtension(db, { agreement_id: agreementId });
    // const statusCode = latestPlan && latestPlan.status && latestPlan.status.code;
    // if (latestPlan && latestPlan.uploaded && statusCode && statusCode !== 'O') {
    //   throw errorWithCode('The current plan is in progress.', 409);
    // }

    const plan = await Plan.create(db, body);

    return res.status(200).json(plan).end();
  } catch (err) {
    throw err;
  }
}));

// Update an existing plan
router.put('/:planId?', asyncMiddleware(async (req, res) => {
  const {
    planId,
  } = req.params;
  const {
    body,
  } = req;

  if (!planId) {
    throw errorWithCode('planId is required in path', 400);
  }

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    if (!userCanAccessAgreement(req.user, agreementId)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    // Don't allow the agreement relation to be updated.
    delete body.agreementId;

    const plan = await Plan.update(db, { id: planId }, body);
    await plan.fetchGrazingSchedules();
    await plan.fetchPastures();

    return res.status(200).json(plan).end();
  } catch (err) {
    throw err;
  }
}));

// Update the status of an existing plan.
router.put('/:planId?/status', asyncMiddleware(async (req, res) => {
  const {
    statusId,
  } = req.body;
  const {
    planId,
  } = req.params;

  if (!statusId || !isNumeric(statusId)) {
    throw errorWithCode('statusId must be provided in body and be numeric', 400);
  }

  if (!planId) {
    throw errorWithCode('planId must be provided in path', 400);
  }

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    if (!userCanAccessAgreement(req.user, agreementId)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    // make sure the status exists.
    // TODO:(jl) Should we make sure the statis is active?
    const results = await PlanStatus.find(db, { id: statusId });
    if (results.length === 0) {
      throw errorWithCode('You must supply a valid status ID', 403);
    }

    const planStatus = results.pop();

    await Plan.update(db, { id: planId }, { status_id: statusId });

    return res.status(200).json(planStatus).end();
  } catch (err) {
    throw err;
  }
}));

//
// Pasture
//

// Add a Pasture to an existing Plan
router.post('/:planId?/pasture', asyncMiddleware(async (req, res) => {
  const {
    body,
  } = req;
  const {
    planId,
  } = req.params;

  if (!planId) {
    throw errorWithCode('planId must be provided in path', 400);
  }

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    if (!userCanAccessAgreement(req.user, agreementId)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    // Use the planId from the URL so that we know exactly what plan
    // is being updated.
    delete body.planId;
    delete body.plan_id;

    const pasture = await Pasture.create(db, { ...body, ...{ plan_id: planId } });

    return res.status(200).json(pasture).end();
  } catch (err) {
    throw err;
  }
}));

// Update the existing Pasture of an existing Plan
router.put('/:planId?/pasture/:pastureId?', asyncMiddleware(async (req, res) => {
  const {
    planId,
    pastureId,
  } = req.params;
  const {
    body,
  } = req;

  if (!planId) {
    throw errorWithCode('planId must be provided in path', 400);
  }

  if (!pastureId) {
    throw errorWithCode('pastureId must be provided in path', 400);
  }

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    if (!userCanAccessAgreement(req.user, agreementId)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    // Use the planId from the URL so that we know exactly what plan
    // is being updated and to ensure its not reassigned.
    delete body.planId;
    delete body.plan_id;

    const pasture = await Pasture.update(db, { ...body, ...{ plan_id: planId } });

    return res.status(200).json(pasture).end();
  } catch (err) {
    throw err;
  }
}));

//
// Schedule
//

// Add a Schedule (and relted Grazing Schedule Entries) to an existing Plan
router.post('/:planId?/schedule', asyncMiddleware(async (req, res) => {
  const {
    planId,
  } = req.params;
  const {
    body,
  } = req;
  const {
    grazingScheduleEntries,
  } = body;

  if (!planId) {
    throw errorWithCode('planId is required in path', 400);
  }

  if (!grazingScheduleEntries) {
    throw errorWithCode('grazingScheduleEntries is required in body', 400);
  }

  grazingScheduleEntries.forEach((entry) => {
    if (!entry.livestockTypeId) {
      throw errorWithCode('grazingScheduleEntries must have livestockType');
    }
  });

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    if (!userCanAccessAgreement(req.user, agreementId)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    // Use the planId from the URL so that we know exactly what plan
    // is being updated and to ensure its not reassigned.
    delete body.planId;
    delete body.plan_id;

    // TODO:(jl) Wrap this in a transaction so that its an all
    // or nothing clreate.
    const schedule = await GrazingSchedule.create(db, { ...body, ...{ plan_id: planId } });
    // eslint-disable-next-line arrow-body-style
    const promises = grazingScheduleEntries.map((entry) => {
      return GrazingScheduleEntry.create(db, {
        ...entry,
        ...{ grazing_schedule_id: schedule.id },
      });
    });

    await Promise.all(promises);
    await schedule.fetchGrazingSchedulesEntries();

    return res.status(200).json(schedule).end();
  } catch (error) {
    throw error;
  }
}));

// Update an existing Schedule (and relted Grazing Schedule Entries) of an existing Plan
router.put('/:planId?/schedule/:scheduleId?', asyncMiddleware(async (req, res) => {
  const {
    planId,
    scheduleId,
  } = req.params;
  const {
    body,
  } = req;
  const {
    grazingScheduleEntries,
  } = body;

  if (!planId) {
    throw errorWithCode('planId is required in path', 400);
  }

  if (!grazingScheduleEntries) {
    throw errorWithCode('grazingScheduleEntries is required in body', 400);
  }

  grazingScheduleEntries.forEach((entry) => {
    if (!entry.livestockTypeId) {
      throw errorWithCode('grazingScheduleEntries must have livestockType');
    }
  });

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    if (!userCanAccessAgreement(req.user, agreementId)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    // Use the planId from the URL so that we know exactly what plan
    // is being updated and to ensure its not reassigned.
    delete body.planId;
    delete body.plan_id;

    // TODO:(jl) Wrap this in a transaction so that its an all
    // or nothing clreate.
    const schedule = await GrazingSchedule.update(
      db,
      {
        id: scheduleId,
      },
      {
        ...body,
        ...{ plan_id: planId },
      },
    );
    // eslint-disable-next-line arrow-body-style
    const promises = grazingScheduleEntries.map((entry) => {
      delete entry.scheduleId; // eslint-disable-line no-param-reassign
      delete entry.schedule_id; // eslint-disable-line no-param-reassign
      if (entry.id) {
        return GrazingScheduleEntry.update(
          db,
          {
            id: entry.id,
          },
          {
            ...entry,
            ...{ grazing_schedule_id: scheduleId },
          },
        );
      }

      return GrazingScheduleEntry.create(
        db,
        {
          ...entry,
          ...{ grazing_schedule_id: scheduleId },
        },
      );
    });

    await Promise.all(promises);
    await schedule.fetchGrazingSchedulesEntries();

    return res.status(200).json(schedule).end();
  } catch (error) {
    throw error;
  }
}));

// Remove a Schedule (and relted Grazing Schedule Entries) from an existing Plan
router.delete('/:planId?/schedule/:scheduleId?', asyncMiddleware(async (req, res) => {
  const {
    planId,
    scheduleId,
  } = req.params;

  if (!planId) {
    throw errorWithCode('planId is required in path', 400);
  }

  if (!scheduleId) {
    throw errorWithCode('scheduleId is required in path', 400);
  }

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    if (!userCanAccessAgreement(req.user, agreementId)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    // WARNING: This will do a cascading delete on any grazing schedule
    // entries. It will not modify other relations.
    const result = await GrazingSchedule.removeById(db, scheduleId);
    if (result === 0) {
      throw errorWithCode('No such schedule exists', 400);
    }

    return res.status(204).end();
  } catch (error) {
    const message = `Unable to delete schedule ${scheduleId}`;
    logger.error(`${message}, error = ${error.message}`);

    throw error;
  }
}));

// Remove a Grazing Schedule Entrie from Grazing Schedule
router.delete(
  '/:planId?/schedule/:scheduleId?/entry/:grazingScheduleEntryId?',
  asyncMiddleware(async (req, res) => {
    const {
      planId,
      scheduleId,
      grazingScheduleEntryId,
    } = req.params;

    if (!planId) {
      throw errorWithCode('planId is required in path', 400);
    }

    if (!scheduleId) {
      throw errorWithCode('scheduleId is required in path', 400);
    }

    if (!grazingScheduleEntryId) {
      throw errorWithCode('grazingScheduleEntryId is required in path', 400);
    }

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      if (!userCanAccessAgreement(req.user, agreementId)) {
        throw errorWithCode('You do not access to this agreement', 403);
      }

      // WARNING: This will do a cascading delete on any grazing schedule
      // entries. It will not modify other relations.
      const result = await GrazingScheduleEntry.removeById(db, grazingScheduleEntryId);
      if (result === 0) {
        throw errorWithCode('No such grazing schedule entry exists', 400);
      }

      return res.status(204).end();
    } catch (error) {
      const message = `Unable to delete grazing schedule entry ${grazingScheduleEntryId}`;
      logger.error(`${message}, error = ${error.message}`);

      throw error;
    }
  }),
);

//
// Minister Issues
//

const validateMinisterIssueOpperation = async (planId, body) => {
  const {
    pastures,
  } = body;

  if (!planId) {
    throw errorWithCode('The planId is required in path', 400);
  }

  if (!pastures || pastures.length === 0) {
    throw errorWithCode('At least one pasture is required', 400);
  }

  try {
    // Make sure the all the pastures associated to the issue belong to the
    // current plan.
    const plan = await Plan.findById(db, planId);
    await plan.fetchPastures();
    const okPastureIds = plan.pastures.map(pasture => pasture.id);
    const status = pastures.every(i => okPastureIds.includes(i));
    if (!status) {
      throw errorWithCode('Some pastures do not belong to the current user ', 400);
    }
  } catch (error) {
    throw errorWithCode('Unable to confirm Plan ownership', 500);
  }
};

const sanitizeDataForMinisterIssue = (body) => {
  /* eslint-disable no-param-reassign */
  // Use the planId from the URL so that we know exactly what plan
  // is being updated and to ensure its not reassigned.
  delete body.planId;
  delete body.plan_id;
  /* eslint-enable no-param-reassign */

  return body;
};

const verifyPlanOwnership = async (user, planId) => {
  const agreementId = await Plan.agreementForPlanId(db, planId);
  if (!userCanAccessAgreement(user, agreementId)) {
    throw errorWithCode('You do not access to this agreement', 403);
  }
};

// Add a Minister Issue to an existing Plan
router.post('/:planId?/issue', asyncMiddleware(async (req, res) => {
  const {
    planId,
  } = req.params;
  const {
    body,
  } = req;
  const {
    pastures,
  } = body;

  try {
    verifyPlanOwnership(req.user, planId);
    validateMinisterIssueOpperation(planId, body);
    const data = sanitizeDataForMinisterIssue(body);

    const issue = await MinisterIssue.create(db, { ...data, ...{ plan_id: planId } });
    const promises = pastures.map(id =>
      MinisterIssuePasture.create(db, { pasture_id: id, minister_issue_id: issue.id }));

    await Promise.all(promises);

    return res.status(200).json(issue).end();
  } catch (error) {
    throw error;
  }
}));

// Update a Minister Issue to an existing Plan
router.put('/:planId?/issue/:issueId?', asyncMiddleware(async (req, res) => {
  const {
    planId,
    issueId,
  } = req.params;
  const {
    body,
  } = req;
  const {
    pastures,
  } = body;

  try {
    verifyPlanOwnership(req.user, planId);

    if (!issueId) {
      throw errorWithCode('The issueId is required in path', 400);
    }

    validateMinisterIssueOpperation(planId, body);
    const data = sanitizeDataForMinisterIssue(body);

    // update the existing issue.
    const issue = await MinisterIssue.update(db, { id: issueId }, data);

    // remove the existing link between the issue and it's related pastures.
    const issuePastures = await Promise.all(pastures.map(id =>
      MinisterIssuePasture.find(db, { pasture_id: id, minister_issue_id: issue.id })));
    const flatIssuePastures = flatten(issuePastures);

    await Promise.all(flatIssuePastures.map(item =>
      MinisterIssuePasture.removeById(db, item.id)));

    // build the new relation between the issue and it's pastures.
    await Promise.all(pastures.map(id =>
      MinisterIssuePasture.create(db, { pasture_id: id, minister_issue_id: issue.id })));

    return res.status(200).json(issue).end();
  } catch (error) {
    throw error;
  }
}));

// Remove a Minister Issue from an existing Plan
router.delete('/:planId?/issue/:issueId?', asyncMiddleware(async (req, res) => {
  const {
    planId,
    issueId,
  } = req.params;

  try {
    if (!planId) {
      throw errorWithCode('The planId is required in path', 400);
    }

    if (!issueId) {
      throw errorWithCode('The issueId is required in path', 400);
    }

    verifyPlanOwnership(req.user, planId);

    await MinisterIssue.removeById(db, issueId);

    return res.status(204).json().end();
  } catch (error) {
    throw error;
  }
}));

//
// Minister Issue Action
//

// Add a Minister Issue Action to an existing Minister Issue
router.post('/:planId?/issue/:issueId?/action', asyncMiddleware(async (req, res) => {
  const { body, params: { planId, issueId } } = req;
  const { actionTypeId, detail } = body;

  try {
    if (!planId) {
      throw errorWithCode('The planId is required in path', 400);
    }
    if (!issueId) {
      throw errorWithCode('The issueId is required in path', 400);
    }
    if (!actionTypeId) {
      throw errorWithCode('The actionTypeId is required in path', 400);
    }

    verifyPlanOwnership(req.user, planId);
    const action = await MinisterIssueAction.create(
      db,
      {
        detail,
        issue_id: issueId,
        action_type_id: actionTypeId,
      },
    );

    return res.status(200).json(action).end();
  } catch (error) {
    throw error;
  }
}));

// Update a Minister Issue Action to an existing Minister Issue
router.put('/:planId?/issue/:issueId?/action/:actionId', asyncMiddleware(async (req, res) => {
  const { body, params: { planId, issueId, actionId } } = req;
  const { actionTypeId, detail } = body;
  try {
    if (!planId) {
      throw errorWithCode('The planId is required in path', 400);
    }
    if (!issueId) {
      throw errorWithCode('The issueId is required in path', 400);
    }
    if (!actionId) {
      throw errorWithCode('The actionId is required in path', 400);
    }
    if (!actionTypeId) {
      throw errorWithCode('The actionTypeId is required in path', 400);
    }

    verifyPlanOwnership(req.user, planId);
    const updatedAction = await MinisterIssueAction.update(
      db,
      { id: actionId },
      {
        detail,
        actionId,
      },
    );

    return res.status(200).json(updatedAction).end();
  } catch (error) {
    throw error;
  }
}));

// Update a Minister Issue Action to an existing Minister Issue
router.delete('/:planId?/issue/:issueId?/action/:actionId', asyncMiddleware(async (req, res) => {
  const { planId, issueId, actionId } = req.params;

  try {
    if (!planId) {
      throw errorWithCode('The planId is required in path', 400);
    }
    if (!issueId) {
      throw errorWithCode('The issueId is required in path', 400);
    }
    if (!actionId) {
      throw errorWithCode('The actionId is required in path', 400);
    }

    verifyPlanOwnership(req.user, planId);
    await MinisterIssueAction.removeById(db, actionId);

    return res.status(204).json().end();
  } catch (error) {
    throw error;
  }
}));
module.exports = router;
