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
import { PLAN_STATUS, PURPOSE_OF_ACTION, PLANT_COMMUNITY_CRITERIA } from '../../constants';

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
  AmendmentConfirmation,
  PlantCommunity,
  PlantCommunityAction,
  IndicatorPlant,
  MonitoringArea,
  MonitoringAreaPurpose,
} = dm;

const canUserAccessThisAgreement = async (user, agreementId) => {
  const [agreement] = await Agreement.find(db, { forest_file_id: agreementId });
  if (!agreement) {
    throw errorWithCode('Unable to find the related agreement', 500);
  }

  const can = await user.canAccessAgreement(db, agreement);
  if (!can) {
    throw errorWithCode('You do not access to this agreement', 403);
  }
};

// Get a specific plan.
router.get('/:planId', asyncMiddleware(async (req, res) => {
  const { user, params } = req;
  const { planId } = params;

  checkRequiredFields(
    ['planId'], 'path', params,
  );

  try {
    const [plan] = await Plan.findWithStatusExtension(db, { 'plan.id': planId }, ['id', 'desc']);
    if (!plan) {
      throw errorWithCode('Plan not found', 404);
    }
    const { agreementId } = plan;
    await canUserAccessThisAgreement(user, agreementId);

    const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(
      db, { forest_file_id: agreementId },
    );
    await agreement.eagerloadAllOneToManyExceptPlan();
    agreement.transformToV1();

    await plan.eagerloadAllOneToMany();
    plan.agreement = agreement;

    return res.status(200).json(plan).end();
  } catch (error) {
    logger.error(`Unable to fetch plan, error = ${error.message}`);
    throw errorWithCode('There was a problem fetching the record', 500);
  }
}));

// Create a new plan.
router.post('/', asyncMiddleware(async (req, res) => {
  const { body, user } = req;
  const { agreementId, amendmentTypeId } = body;

  checkRequiredFields(
    ['statusId'], 'body', body,
  );

  try {
    await canUserAccessThisAgreement(user, agreementId);

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

    // delete the old plan whose status is 'Staff Draft'
    const staffDraftStatus = await PlanStatus.findOne(db, {
      code: 'SD',
    });
    await Plan.remove(db, {
      agreement_id: agreement.id,
      status_id: staffDraftStatus.id,
    });

    const plan = await Plan.create(db, { ...body, creator_id: user.id });

    // create unsiged confirmations for AHs when creating an amendment
    if (amendmentTypeId) {
      await AmendmentConfirmation.createConfirmations(db, agreementId, plan.id);
    }

    return res.status(200).json(plan).end();
  } catch (err) {
    throw err;
  }
}));

// Update an existing plan
router.put('/:planId?', asyncMiddleware(async (req, res) => {
  const { params, body, user } = req;
  const { planId } = params;

  checkRequiredFields(
    ['planId'], 'path', params,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

    // Don't allow the agreement relation to be updated.
    delete body.agreementId;

    await Plan.update(db, { id: planId }, body);
    const [plan] = await Plan.findWithStatusExtension(db, { 'plan.id': planId }, ['id', 'desc']);
    await plan.eagerloadAllOneToMany();

    const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(
      db, { forest_file_id: agreementId },
    );
    await agreement.eagerloadAllOneToManyExceptPlan();
    agreement.transformToV1();
    plan.agreement = agreement;

    return res.status(200).json(plan).end();
  } catch (err) {
    throw err;
  }
}));

const updatePlanStatus = async (planId, status = {}, user) => {
  try {
    const plan = await Plan.findOne(db, { id: planId });
    const body = { status_id: status.id };
    switch (status.code) {
      case PLAN_STATUS.APPROVED:
        body.effective_at = new Date();
        break;
      case PLAN_STATUS.STANDS:
        body.effective_at = new Date();
        body.submitted_at = new Date();
        break;
      case PLAN_STATUS.WRONGLY_MADE_WITHOUT_EFFECT:
        body.effective_at = null;
        break;
      case PLAN_STATUS.SUBMITTED_FOR_FINAL_DECISION:
      case PLAN_STATUS.SUBMITTED_FOR_REVIEW:
        body.submitted_at = new Date();
        break;
      case PLAN_STATUS.AWAITING_CONFIRMATION:
        if (user.id !== plan.creatorId) {
          throw errorWithCode('Only the user who created the amendment can submit.', 403);
        }
        // it can be the case where an amendment is resubmitted
        await AmendmentConfirmation.refreshConfirmations(db, planId, user);
        break;
      default:
        break;
    }

    const updatedPlan = await Plan.update(db, { id: planId }, body);
    return updatedPlan;
  } catch (err) {
    throw err;
  }
};

// Update the status of an existing plan.
router.put('/:planId?/status', asyncMiddleware(async (req, res) => {
  const { params, body, user } = req;
  const { statusId } = body;
  const { planId } = params;

  checkRequiredFields(
    ['planId'], 'path', params,
  );

  checkRequiredFields(
    ['statusId'], 'body', body,
  );

  if (!isNumeric(statusId)) {
    throw errorWithCode('statusId must be numeric', 400);
  }

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

    const planStatuses = await PlanStatus.find(db, { active: true });

    // make sure the status exists.
    const status = planStatuses.find(s => s.id === statusId);
    if (!status) {
      throw errorWithCode('You must supply a valid status ID', 403);
    }

    await updatePlanStatus(planId, status, user);

    return res.status(200).json(status).end();
  } catch (err) {
    throw err;
  }
}));

// update existing amendment confirmation
router.put('/:planId?/confirmation/:confirmationId?', asyncMiddleware(async (req, res) => {
  const {
    query: { isMinorAmendment },
    params,
    body,
    user,
  } = req;
  const { planId, confirmationId } = params;

  checkRequiredFields(
    ['planId', 'confirmationId'], 'path', params,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(req.user, agreementId);

    const confirmation = await AmendmentConfirmation.update(db, { id: confirmationId }, body);
    const allConfirmations = await AmendmentConfirmation.find(db, { plan_id: planId });
    let allConfirmed = true;
    allConfirmations.map((c) => {
      if (!c.confirmed) {
        allConfirmed = false;
      }
      return undefined;
    });

    // update the amendment status when the last agreement holder confirms
    if (allConfirmed) {
      const planStatuses = await PlanStatus.find(db, { active: true });
      const status = planStatuses.find(s => (
        s.code === (isMinorAmendment === 'true'
          ? PLAN_STATUS.STANDS
          : PLAN_STATUS.SUBMITTED_FOR_FINAL_DECISION)
      ));
      const plan = await updatePlanStatus(planId, status, user);
      return res.status(200).json({ allConfirmed, plan, confirmation }).end();
    }

    return res.status(200).json({ allConfirmed, confirmation }).end();
  } catch (err) {
    throw err;
  }
}));

// create a plan status history
router.post('/:planId?/status-history', asyncMiddleware(async (req, res) => {
  const { params, body, user } = req;
  const { planId } = params;

  checkRequiredFields(
    ['planId'], 'path', params,
  );
  checkRequiredFields(
    ['userId', 'fromPlanStatusId', 'toPlanStatusId', 'note'], 'body', body,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

    const { id: historyId } = await PlanStatusHistory.create(db, { ...body, planId });
    const [planStatusHistory] = await PlanStatusHistory.findWithUser(
      db, { 'plan_status_history.id': historyId },
    );
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
  const { params: { planId }, body, user } = req;

  if (!planId) {
    throw errorWithCode('planId must be provided in path', 400);
  }

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

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
  const { params, body, user } = req;
  const { planId, pastureId } = params;

  checkRequiredFields(
    ['planId', 'pastureId'], 'path', params,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

    // Use the planId from the URL so that we know exactly what plan
    // is being updated and to ensure its not reassigned.
    delete body.planId;
    delete body.plan_id;

    const pasture = await Pasture.update(
      db,
      { id: pastureId },
      { ...body, plan_id: planId },
    );

    return res.status(200).json(pasture).end();
  } catch (err) {
    throw err;
  }
}));

// create a plant community
router.post(
  '/:planId?/pasture/:pastureId?/plant-community',
  asyncMiddleware(async (req, res) => {
    const { params, body, user } = req;
    const { planId, pastureId } = params;

    checkRequiredFields(
      ['planId', 'pastureId'], 'params', params,
    );

    checkRequiredFields(
      ['communityTypeId', 'purposeOfAction'], 'body', body,
    );

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await canUserAccessThisAgreement(user, agreementId);

      const pasture = await Pasture.findOne(db, { id: pastureId });
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const { purposeOfAction } = body;
      if (!PURPOSE_OF_ACTION.includes(purposeOfAction)) {
        throw errorWithCode(`Unacceptable purpose of action with "${purposeOfAction}"`);
      }
      const plantCommunity = await PlantCommunity.create(db, { ...body, pastureId });
      return res.status(200).json(plantCommunity).end();
    } catch (error) {
      throw error;
    }
  }),
);

// create a plant community action
router.post(
  '/:planId?/pasture/:pastureId?/plant-community/:communityId/action',
  asyncMiddleware(async (req, res) => {
    const { params, body, user } = req;
    const { planId, pastureId, communityId } = params;

    checkRequiredFields(
      ['planId', 'pastureId', 'communityId'], 'path', params,
    );

    checkRequiredFields(
      ['actionTypeId'], 'body', body,
    );

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await canUserAccessThisAgreement(user, agreementId);

      const pasture = await Pasture.findOne(db, { id: pastureId });
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const plantCommunity = await PlantCommunity.findOne(db, { id: communityId });
      if (!plantCommunity) {
        throw errorWithCode(`No plant community found with id: ${communityId}`);
      }
      const plantCommunityAction = await PlantCommunityAction.create(
        db,
        {
          ...body,
          plantCommunityId: communityId,
        },
      );
      return res.status(200).json(plantCommunityAction).end();
    } catch (error) {
      throw error;
    }
  }),
);

// create a indicator plant
router.post(
  '/:planId?/pasture/:pastureId?/plant-community/:communityId/indicator-plant',
  asyncMiddleware(async (req, res) => {
    const { params, body, user } = req;
    const { planId, pastureId, communityId } = params;
    const { criteria } = body;

    checkRequiredFields(
      ['planId', 'pastureId', 'communityId'], 'path', params,
    );

    checkRequiredFields(
      ['criteria'], 'body', body,
    );

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await canUserAccessThisAgreement(user, agreementId);

      if (!PLANT_COMMUNITY_CRITERIA.includes(criteria)) {
        throw errorWithCode(`Unacceptable plant community criteria with "${criteria}"`);
      }

      const pasture = await Pasture.findOne(db, { id: pastureId });
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const plantCommunity = await PlantCommunity.findOne(db, { id: communityId });
      if (!plantCommunity) {
        throw errorWithCode(`No plant community found with id: ${communityId}`);
      }

      const indicatorPlant = await IndicatorPlant.create(
        db,
        {
          ...body,
          plantCommunityId: communityId,
        },
      );
      return res.status(200).json(indicatorPlant).end();
    } catch (error) {
      throw error;
    }
  }),
);

// create a monitoring area
router.post(
  '/:planId?/pasture/:pastureId?/plant-community/:communityId/monitoring-area',
  asyncMiddleware(async (req, res) => {
    const { params, body, user } = req;
    const { planId, pastureId, communityId } = params;
    const { purposeTypeIds } = body;

    checkRequiredFields(
      ['planId', 'pastureId', 'communityId'], 'path', params,
    );

    checkRequiredFields(
      ['name', 'purposeTypeIds'], 'body', body,
    );

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await canUserAccessThisAgreement(user, agreementId);

      const pasture = await Pasture.findOne(db, { id: pastureId });
      if (!pasture) {
        throw errorWithCode(`No pasture found with id: ${pastureId}`);
      }
      const plantCommunity = await PlantCommunity.findOne(db, { id: communityId });
      if (!plantCommunity) {
        throw errorWithCode(`No plant community found with id: ${communityId}`);
      }

      const monitoringArea = await MonitoringArea.create(
        db,
        { ...body, plantCommunityId: communityId },
      );

      const promises = purposeTypeIds.map(pId => (
        MonitoringAreaPurpose.create(db, {
          monitoringAreaId: monitoringArea.id,
          purposeTypeId: pId,
        })
      ));
      await Promise.all(promises);
      await monitoringArea.fetchMonitoringAreaPurposes(
        db, { monitoring_area_id: monitoringArea.id },
      );

      return res.status(200).json(monitoringArea).end();
    } catch (error) {
      throw error;
    }
  }),
);

//
// Schedule
//

// Add a Schedule (and relted Grazing Schedule Entries) to an existing Plan
router.post('/:planId?/schedule', asyncMiddleware(async (req, res) => {
  const { params, body, user } = req;
  const { planId } = params;
  const { grazingScheduleEntries } = body;

  checkRequiredFields(
    ['planId'], 'path', params,
  );
  checkRequiredFields(
    ['grazingScheduleEntries'], 'body', body,
  );

  grazingScheduleEntries.forEach((entry) => {
    if (!entry.livestockTypeId) {
      throw errorWithCode('grazingScheduleEntries must have livestockType');
    }
  });

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

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
  const { body, user, params } = req;
  const { grazingScheduleEntries } = body;
  const { planId, scheduleId } = params;

  checkRequiredFields(
    ['planId', 'scheduleId'], 'path', params,
  );
  checkRequiredFields(
    ['grazingScheduleEntries'], 'body', body,
  );

  grazingScheduleEntries.forEach((entry) => {
    if (!entry.livestockTypeId) {
      throw errorWithCode('grazingScheduleEntries must have livestockType');
    }
  });

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

    // Use the planId from the URL so that we know exactly what plan
    // is being updated and to ensure its not reassigned.
    delete body.planId;
    delete body.plan_id;

    // TODO:(jl) Wrap this in a transaction so that its an all
    // or nothing clreate.
    const schedule = await GrazingSchedule.update(
      db,
      { id: scheduleId },
      { ...body, plan_id: planId },
    );
    // eslint-disable-next-line arrow-body-style
    const promises = grazingScheduleEntries.map((entry) => {
      delete entry.scheduleId; // eslint-disable-line no-param-reassign
      delete entry.schedule_id; // eslint-disable-line no-param-reassign
      if (entry.id) {
        return GrazingScheduleEntry.update(
          db,
          { id: entry.id },
          { ...entry, grazing_schedule_id: scheduleId },
        );
      }

      return GrazingScheduleEntry.create(
        db,
        { ...entry, grazing_schedule_id: scheduleId },
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
  const { user, params } = req;
  const { planId, scheduleId } = params;

  checkRequiredFields(
    ['planId', 'scheduleId'], 'path', params,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

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
  const { body, params } = req;
  const { planId, scheduleId } = params;

  checkRequiredFields(
    ['planId', 'scheduleId'], 'path', params,
  );

  checkRequiredFields(
    ['livestockTypeId'], 'body', body,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(req.user, agreementId);
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
    const { params, user } = req;
    const { planId, grazingScheduleEntryId } = params;

    checkRequiredFields(
      ['planId', 'scheduleId', 'grazingScheduleEntryId'], 'path', params,
    );

    try {
      const agreementId = await Plan.agreementForPlanId(db, planId);
      await canUserAccessThisAgreement(user, agreementId);
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
  const { pastures } = body;

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
  const { body, params, user } = req;
  const { planId } = params;
  const { pastures } = body;

  checkRequiredFields(
    ['planId'], 'path', params,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);
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
  const { body, params, user } = req;
  const { planId, issueId } = params;
  const { pastures } = body;

  checkRequiredFields(
    ['planId', 'issueId'], 'path', params,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

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
  const { params, user } = req;
  const { planId, issueId } = params;

  checkRequiredFields(
    ['planId', 'issueId'], 'path', params,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

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
  const { body, params, user } = req;
  const { planId, issueId } = params;
  const { actionTypeId, detail } = body;

  checkRequiredFields(
    ['planId', 'issueId'], 'path', params,
  );

  checkRequiredFields(
    ['actionTypeId'], 'body', body,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

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
  const { body, params, user } = req;
  const { planId, actionId } = params;
  const { detail } = body;

  checkRequiredFields(
    ['planId', 'issueId', 'actionId'], 'path', params,
  );

  checkRequiredFields(
    ['actionTypeId'], 'body', body,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

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
  const { params, user } = req;
  const { planId, actionId } = params;

  checkRequiredFields(
    ['planId', 'issueId', 'actionId'], 'path', params,
  );

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    await canUserAccessThisAgreement(user, agreementId);

    await MinisterIssueAction.removeById(db, actionId);

    return res.status(204).json().end();
  } catch (error) {
    throw error;
  }
}));
module.exports = router;
