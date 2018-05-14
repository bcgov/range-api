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

import { Router } from 'express';
import config from '../../config';
import DataManager from '../../libs/db';
import DataManager2 from '../../libs/db2';
import { logger } from '../../libs/logger';
import { asyncMiddleware, errorWithCode, isNumeric } from '../../libs/utils';

const router = new Router();

const dm2 = new DataManager2(config);
const {
  db,
} = dm2;
const Plan2 = dm2.Plan;
const Agreement2 = dm2.Agreement;
const PlanStatus2 = dm2.PlanStatus;

const dm = new DataManager(config);
const {
  Pasture,
  Plan,
  GrazingSchedule,
  GrazingScheduleEntry,
  INCLUDE_PLAN_MODEL,
  INCLUDE_GRAZING_SCHEDULE_ENTRY_MODEL,
} = dm;

const { model, ...planQueryOptions } = INCLUDE_PLAN_MODEL;

const userCanAccessAgreement = async (user, agreementId) => {
  const agreements = await Agreement2.find(db, { forest_file_id: agreementId });
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
    planId: pId,
  } = req.params;

  const planId = Number(pId);
  try {
    const agreementId = await Plan2.agreementForPlanId(db, planId);
    if (!userCanAccessAgreement(req.user, agreementId)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    const results = await Agreement2.findWithAllRelations(db, { forest_file_id: agreementId });
    const myAgreement = results.pop();
    myAgreement.transformToV1();

    // TODO:(jl) This should return the Plan, not the agreement with the embeded
    // plan.

    const plans = myAgreement.plans.filter(p => p.id === planId);
    delete myAgreement.plans;
    myAgreement.plan = plans.pop();

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
  } = body;

  try {
    if (!userCanAccessAgreement(req.user, agreementId)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    const agreement = await Agreement2.findById(db, agreementId);
    if (!agreement) {
      throw errorWithCode('agreement not found', 404);
    }

    if (body.id || body.planId) {
      const plan = await Plan2.findById(db, body.id || body.planId);
      if (plan) {
        throw errorWithCode('A plan with this ID exists. Use PUT.', 409);
      }
    }

    const plan = await Plan2.create(db, body);

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
    const agreementId = await Plan2.agreementForPlanId(db, planId);
    if (!userCanAccessAgreement(req.user, agreementId)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    // Don't allow the agreement relation to be updated.
    delete body.agreementId;

    const plan = await Plan2.update(db, { id: planId }, body);
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
    const agreementId = await Plan2.agreementForPlanId(db, planId);
    if (!userCanAccessAgreement(req.user, agreementId)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    // make sure the status exists.
    // TODO:(jl) Should we make sure the statis is active?
    const results = await PlanStatus2.find(db, { id: statusId });
    if (results.length === 0) {
      throw errorWithCode('You must supply a valid status ID', 403);
    }

    const planStatus = results.pop();

    await Plan2.update(db, { id: planId }, { status_id: statusId });

    return res.status(200).json(planStatus).end();
  } catch (err) {
    throw err;
  }
}));

//
// Pasture
//

router.post('/:planId?/pasture', asyncMiddleware(async (req, res) => {
  const {
    createdAt,
    updatedAt,
    ...body
  } = req.body;

  const {
    planId,
  } = req.params;

  if (!planId) {
    throw errorWithCode('planId must be provided in path', 400);
  }

  try {
    const plan = await Plan.findById(planId);
    const pasture = await Pasture.create({ ...body, planId });

    await plan.addPasture(pasture);

    return res.status(200).json(pasture).end();
  } catch (err) {
    throw err;
  }
}));

//
// Schedule
//

router.post('/:planId?/schedule', asyncMiddleware(async (req, res) => {
  const {
    planId,
  } = req.params;

  const {
    createdAt,
    updatedAt,
    ...body
  } = req.body;

  const {
    year,
    grazingScheduleEntries,
  } = body;

  if (!planId) {
    throw errorWithCode('planId is required in path', 400);
  }

  if (!year) {
    throw errorWithCode('year is required in body', 400);
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
    const plan = await Plan.findById(planId);
    if (!plan) {
      throw errorWithCode('plan not found', 404);
    }

    const schedule = await GrazingSchedule.create(body);
    const promises = grazingScheduleEntries.map((entry) => { // eslint-disable-line arrow-body-style
      return GrazingScheduleEntry.create({ ...entry, grazingScheduleId: schedule.id });
    });

    await Promise.all(promises);
    await plan.addGrazingSchedule(schedule);
    await plan.save();

    const aSchedule = await GrazingSchedule.findById(schedule.id, {
      include: [INCLUDE_GRAZING_SCHEDULE_ENTRY_MODEL],
    });

    return res.status(200).json(aSchedule).end();
  } catch (err) {
    throw err;
  }
}));

router.put('/:planId?/schedule/:scheduleId?', asyncMiddleware(async (req, res) => {
  const {
    planId,
    scheduleId,
  } = req.params;

  const {
    createdAt,
    updatedAt,
    ...body
  } = req.body;

  const {
    year,
    grazingScheduleEntries,
  } = body;

  if (!planId) {
    throw errorWithCode('planId is required in path', 400);
  }

  if (!year) {
    throw errorWithCode('year is required in body', 400);
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
    const plan = await Plan.findById(planId);
    if (!plan) {
      throw errorWithCode('plan not found', 404);
    }

    const schedule = await GrazingSchedule.findById(scheduleId);
    if (!schedule) {
      throw errorWithCode('schedule not found', 404);
    }

    await schedule.update(body);

    const promises = grazingScheduleEntries.map((entry) => { // eslint-disable-line arrow-body-style
      return GrazingScheduleEntry.upsert({ ...entry, ...{ grazingScheduleId: schedule.id } }, {
        returning: true,
      });
    });

    await Promise.all(promises);
    await plan.addGrazingSchedule(schedule);
    await plan.save();

    const aSchedule = await GrazingSchedule.findById(scheduleId, {
      include: [INCLUDE_GRAZING_SCHEDULE_ENTRY_MODEL],
    });

    return res.status(200).json(aSchedule).end();
  } catch (err) {
    throw err;
  }
}));

router.put('/:planId?/pasture/:pastureId?', asyncMiddleware(async (req, res) => {
  const {
    planId,
    pastureId,
  } = req.params;

  const {
    createdAt,
    updatedAt,
    ...body
  } = req.body;

  if (!planId) {
    throw errorWithCode('planId must be provided in path', 400);
  }

  if (!pastureId) {
    throw errorWithCode('pastureId must be provided in path', 400);
  }

  try {
    // By fetching the plan and including the pastures we verify authorization
    // during the fetch.
    const plan = await Plan.findById(planId, planQueryOptions);
    if (!plan) {
      throw errorWithCode('Unable to fetch plan', 400);
    }

    const pasture = plan.pastures.find(item => item.id === parseInt(pastureId, 10));
    if (!pasture) {
      throw errorWithCode(`No pasture with ID ${pastureId} associated to plan ${planId}`, 400);
    }

    const aPasture = await pasture.update({ ...body, planId });

    return res.status(200).json(aPasture).end();
  } catch (err) {
    throw err;
  }
}));

module.exports = router;
