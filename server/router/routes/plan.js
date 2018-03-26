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
import {
  asyncMiddleware,
  isNumeric,
  errorWithCode,
} from '../../libs/utils';

import config from '../../config';
import DataManager from '../../libs/db';

const dm = new DataManager(config);
const {
  Plan,
  PlanStatus,
  Agreement,
} = dm;

const router = new Router();

router.post('/', asyncMiddleware(async (req, res) => {
  const {
    body,
  } = req;

  const {
    id,
    rangeName,
    statusId,
    agreementId,
    extensionId,
  } = body;

  if (!id) {
    throw errorWithCode('id is required in body', 400);
  }

  if (!rangeName) {
    throw errorWithCode('rangeName is required in body', 400);
  }

  if (!statusId) {
    throw errorWithCode('statusId is required in body', 400);
  }

  if (!agreementId) {
    throw errorWithCode('agreementId is required in body', 400);
  }

  if (!extensionId) {
    throw errorWithCode('extensionId is required in body', 400);
  }

  try {
    const agreement = await Agreement.findById(agreementId);
    if (!agreement) {
      throw errorWithCode('agreement not found', 404);
    }

    const plan = await Plan.create(body);
    await agreement.addPlan(plan);
    await agreement.save();

    return res.status(200).json(plan).end();
  } catch (err) {
    throw err;
  }
}));

router.put('/:planId', asyncMiddleware(async (req, res) => {
  const {
    planId,
  } = req.params;

  const {
    id,
    rangeName,
    statusId,
    agreementId,
    extensionId,
  } = req.body;

  if (!planId) {
    throw errorWithCode('planId is required in path', 400);
  }

  if (!id) {
    throw errorWithCode('id is required in body', 400);
  }

  if (!rangeName) {
    throw errorWithCode('rangeName is required in body', 400);
  }

  if (!statusId) {
    throw errorWithCode('statusId is required in body', 400);
  }

  if (!agreementId) {
    throw errorWithCode('agreementId is required in body', 400);
  }

  if (!extensionId) {
    throw errorWithCode('extensionId is required in body', 400);
  }

  try {
    const [affectedCount] = await Plan.update(req.body, {
      where: {
        planId,
      },
    });

    if (!affectedCount) {
      throw errorWithCode(`No plan with ID ${planId} exists`, 404);
    }

    const plan = await Plan.findById(planId);

    return res.status(200).json(plan).end();
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
      attributes: {
        exclude: ['updatedAt', 'createdAt', 'active'],
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

module.exports = router;
