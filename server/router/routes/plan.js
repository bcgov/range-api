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
import { asyncMiddleware, errorWithCode, isNumeric } from '../../libs/utils';

const router = new Router();
const dm = new DataManager(config);
const {
  transformAgreement,
  ClientType,
  Pasture,
  Plan,
  PlanStatus,
  Agreement,
  GrazingSchedule,
  GrazingScheduleEntry,
  INCLUDE_PLAN_MODEL,
  INCLUDE_ZONE_MODEL,
  INCLUDE_CLIENT_MODEL,
  INCLUDE_AGREEMENT_EXEMPTION_STATUS_MODEL,
  INCLUDE_LIVESTOCK_IDENTIFIER_MODEL,
  INCLUDE_USAGE_MODEL,
  INCLUDE_AGREEMENT_TYPE_MODEL,
  EXCLUDED_AGREEMENT_ATTR,
  INCLUDE_GRAZING_SCHEDULE_ENTRY_MODEL,
} = dm;

const { model, ...planQueryOptions } = INCLUDE_PLAN_MODEL;

// // create grazing scheules (and entries) and associate to Plan
// const createAndUpdateScheduleEntry = async (schedule, body) => {
//   let allEntries = [];
//   body.grazingSchedules.forEach((item) => {
//     const { grazingScheduleEntries = [] } = item;
//     const promises = grazingScheduleEntries.map((e) => {
//       delete e.createdAt; // eslint-disable-line no-param-reassign
//       delete e.updatedAt; // eslint-disable-line no-param-reassign

//       return GrazingScheduleEntry.create({ ...e, ...{ grazingScheduleId: schedule.id } });
//     });

//     allEntries = allEntries.concat(promises);
//   });

//   return Promise.all(allEntries);
// };

// create pastures and associate to Plan -> [pasture, created]
// const createAndUpdatePastures = async (plan, body) => {
//   const { pastures = [] } = body;
//   const options = {
//     returning: true,
//   };

//   const promises = pastures.map((p) => {
//     delete p.createdAt; // eslint-disable-line no-param-reassign
//     delete p.updatedAt; // eslint-disable-line no-param-reassign

//     return Pasture.upsert({ ...p, ...{ planId: plan.id } }, options);
//   });

//   return Promise.all(promises);
// };

// // create grazing scheules (and entries) and associate to Plan
// const createAndUpdateSchedule = async (plan, body) => {
//   const { grazingSchedules = [] } = body;

//   // delete all old pastures and create new pastures
//   await GrazingSchedule.destroy({
//     where: {
//       planId: plan.id,
//     },
//   });

//   const promises = grazingSchedules.map((s) => {
//     delete s.createdAt; // eslint-disable-line no-param-reassign
//     delete s.updatedAt; // eslint-disable-line no-param-reassign

//     return GrazingSchedule.create({ ...s, ...{ planId: plan.id } });
//   });

//   const schedules = await Promise.all(promises);
//   await schedules.map(s => createAndUpdateScheduleEntry(s, body));

//   return schedules;
// };

router.get('/:planId', asyncMiddleware(async (req, res) => {
  const {
    planId: pId,
  } = req.params;
  const planId = Number(pId);
  const plan = await Plan.findById(planId, planQueryOptions);
  const clientTypes = await ClientType.findAll();
  const agreement = await Agreement.findById(plan.agreementId, {
    attributes: {
      exclude: EXCLUDED_AGREEMENT_ATTR,
    },
    include: [
      INCLUDE_CLIENT_MODEL(req.user),
      INCLUDE_AGREEMENT_EXEMPTION_STATUS_MODEL,
      INCLUDE_LIVESTOCK_IDENTIFIER_MODEL,
      INCLUDE_USAGE_MODEL,
      INCLUDE_AGREEMENT_TYPE_MODEL,
      INCLUDE_ZONE_MODEL(),
    ],
  });
  return res.status(200).json({ ...transformAgreement(agreement, clientTypes), plan }).end();
}));

router.post('/', asyncMiddleware(async (req, res) => {
  const { createdAt, updatedAt, ...body } = req.body;
  const {
    agreementId,
  } = body;

  try {
    const agreement = await Agreement.findOne({
      where: {
        id: agreementId,
      },
      include: [INCLUDE_ZONE_MODEL(req.user)],
    });

    if (!agreement) {
      throw errorWithCode('agreement not found', 404);
    }

    if (body.id || body.planId) {
      const plan = await Plan.findById(body.id || body.planId);
      if (plan) {
        throw errorWithCode('A plan with this ID exists. Use PUT.', 409);
      }
    }

    const plan = await Plan.create(body);
    await agreement.addPlan(plan);
    await agreement.save();

    // const createdPlan = await Plan.findById(plan.id, planQueryOptions);

    return res.status(200).json(plan).end();
  } catch (err) {
    throw err;
  }
}));

router.put('/:planId?', asyncMiddleware(async (req, res) => {
  const {
    planId,
  } = req.params;

  const {
    createdAt,
    updatedAt,
    agreementId, // don't allow to change the relationship with the agreement
    ...body
  } = req.body;

  if (!planId) {
    throw errorWithCode('planId is required in path', 400);
  }

  try {
    const [affectedCount] = await Plan.update(body, {
      where: {
        id: planId,
      },
    });

    if (!affectedCount) {
      throw errorWithCode(`No plan with ID ${planId} exists`, 404);
    }

    const aPlan = await Plan.findById(planId, planQueryOptions);

    return res.status(200).json(aPlan).end();
  } catch (err) {
    throw err;
  }
}));

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
    const plan = await Plan.findById(planId);
    if (!plan) {
      throw errorWithCode(`No Plan with ID ${planId} exists`, 404);
    }

    const status = await PlanStatus.findOne({
      where: {
        id: statusId,
      },
    });
    if (!status) {
      throw errorWithCode(`No Status with ID ${statusId} exists`, 404);
    }

    await plan.setStatus(status);

    return res.status(200).json(status).end();
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
