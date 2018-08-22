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

import { asyncMiddleware, errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { Router } from 'express';
import { flatten } from 'lodash';
import config from '../../config';
import DataManager from '../../libs/db2';
import { isNumeric, checkRequiredFields } from '../../libs/utils';
import { PLAN_STATUS } from '../../constants';

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
  PlanStatusHistory,
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

const verifyAgreementOwnership = async (user, agreementId) => {
  if (!userCanAccessAgreement(user, agreementId)) {
    throw errorWithCode('You do not access to this agreement', 403);
  }
};

// Get a specific plan.
router.get('/:planId', asyncMiddleware(async (req, res) => {
  const {
    planId,
  } = req.params;

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    verifyAgreementOwnership(req.user, agreementId);

    const results = await Agreement.findWithAllRelations(db, { forest_file_id: agreementId });
    const myAgreement = results.pop();
    myAgreement.transformToV1();

    // TODO:(jl) This should return the Plan, not the agreement with the embeded
    // plan.

    const plans = myAgreement.plans.filter(p => p.id === Number(planId));
    delete myAgreement.plans;
    myAgreement.plan = plans.pop();

    await myAgreement.plan.eagerloadAllOneToMany();

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
    verifyAgreementOwnership(req.user, agreementId);

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
    verifyAgreementOwnership(req.user, agreementId);

    // Don't allow the agreement relation to be updated.
    delete body.agreementId;

    await Plan.update(db, { id: planId }, body);
    const [plan] = await Plan.findWithStatusExtension(db, { 'plan.id': planId }, ['id', 'desc']);
    await plan.eagerloadAllOneToMany();

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
    verifyAgreementOwnership(req.user, agreementId);

    const planStatuses = await PlanStatus.find(db, { active: true });

    // make sure the status exists.
    const status = planStatuses.find(s => s.id === statusId);
    if (!status) {
      throw errorWithCode('You must supply a valid status ID', 403);
    }

    const body = { status_id: statusId };
    if (status.code === PLAN_STATUS.APPROVED) {
      body.effective_at = new Date();
    } else if (status.code === PLAN_STATUS.STANDS) {
      body.effective_at = new Date();
      body.submitted_at = new Date();
    } else if (status.code === PLAN_STATUS.WRONGLY_MADE_WITHOUT_EFFECT) {
      body.effective_at = null;
    }

    await Plan.update(db, { id: planId }, body);

    return res.status(200).json(status).end();
  } catch (err) {
    throw err;
  }
}));

// create a plan status history
router.post('/:planId?/status-history', asyncMiddleware(async (req, res) => {
  const { body, params } = req;
  const { planId } = params;

  if (!planId) {
    throw errorWithCode('planId must be provided in path', 400);
  }
  const missingFields = checkRequiredFields(
    ['userId', 'fromPlanStatusId', 'toPlanStatusId', 'note'], body,
  );
  if (missingFields) {
    throw errorWithCode(`There are missing fields in the body. (${missingFields})`);
  }

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    verifyAgreementOwnership(req.user, agreementId);

    const planStatusHistory = await PlanStatusHistory.create(db, { ...body, planId });
    return res.status(200).json(planStatusHistory).end();
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
    verifyAgreementOwnership(req.user, agreementId);

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
    verifyAgreementOwnership(req.user, agreementId);

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
    throw errorWithCode('The planId is required in path', 400);
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
    verifyAgreementOwnership(req.user, agreementId);

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
    verifyAgreementOwnership(req.user, agreementId);

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
    verifyAgreementOwnership(req.user, agreementId);

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

// Add a grazing schedule entry to an existing grazing schedule
router.post('/:planId?/schedule/:scheduleId?/entry', asyncMiddleware(async (req, res) => {
  const { body, params: { planId, scheduleId } } = req;
  const { livestockTypeId } = body;

  try {
    if (!planId) {
      throw errorWithCode('The planId is required in path', 400);
    }
    if (!scheduleId) {
      throw errorWithCode('The scheduleId is required in path', 400);
    }
    if (!livestockTypeId) {
      throw errorWithCode('The grazing schedule entry must have livestockType');
    }

    const agreementId = await Plan.agreementForPlanId(db, planId);
    verifyAgreementOwnership(req.user, agreementId);
    // Use the planId from the URL so that we know exactly what plan
    // is being updated and to ensure its not reassigned.
    delete body.planId;
    delete body.plan_id;

    const entry = await GrazingScheduleEntry.create(db, {
      ...body,
      ...{ grazing_schedule_id: scheduleId },
    });

    return res.status(200).json(entry).end();
  } catch (error) {
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
      verifyAgreementOwnership(req.user, agreementId);
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
    const agreementId = await Plan.agreementForPlanId(db, planId);
    verifyAgreementOwnership(req.user, agreementId);
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
    const agreementId = await Plan.agreementForPlanId(db, planId);
    verifyAgreementOwnership(req.user, agreementId);

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
    const agreementId = await Plan.agreementForPlanId(db, planId);
    verifyAgreementOwnership(req.user, agreementId);

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
    const agreementId = await Plan.agreementForPlanId(db, planId);
    verifyAgreementOwnership(req.user, agreementId);

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
    const agreementId = await Plan.agreementForPlanId(db, planId);
    verifyAgreementOwnership(req.user, agreementId);

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
    const agreementId = await Plan.agreementForPlanId(db, planId);
    verifyAgreementOwnership(req.user, agreementId);

    await MinisterIssueAction.removeById(db, actionId);

    return res.status(204).json().end();
  } catch (error) {
    throw error;
  }
}));
module.exports = router;
