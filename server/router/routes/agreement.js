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
  errorWithCode,
  isNumeric,
} from '../../libs/utils';
import { logger } from '../../libs/logger';
import config from '../../config';
import DataManager from '../../libs/db';

const dm = new DataManager(config);
const {
  Client,
  Usage,
  Agreement,
  AgreementStatus,
  Zone,
  District,
  LivestockIdentifier,
  LivestockIdentifierLocation,
  LivestockIdentifierType,
  Pasture,
  GrazingSchedule,
  GrazingScheduleEntry,
  LivestockType,
} = dm;

const router = new Router();

// Includes all nested json data for Agreement

const allAgreementChildren = [
  {
    model: Zone,
    include: [District],
    attributes: {
      exclude: ['district_id'],
    },
  },
  {
    model: LivestockIdentifier,
    include: [LivestockIdentifierLocation, LivestockIdentifierType],
    attributes: {
      exclude: ['livestock_identifier_type_id', 'livestock_identifier_location_id'],
    },
  },
  {
    model: Pasture,
  },
  {
    model: GrazingSchedule,
    include: [{
      model: GrazingScheduleEntry,
      include: [LivestockType, Pasture],
      attributes: {
        exclude: ['grazing_schedule_id', 'livestock_type_id', 'agreement_grazing_schedule'],
      },
    }],
  },
  {
    model: Client,
    as: 'primaryAgreementHolder',
    attributes: {
      exclude: ['client_type_id'],
    },
  },
  {
    model: Usage,
    as: 'usage',
    attributes: {
      exclude: ['agreement_id'],
    },
  },
  {
    model: AgreementStatus,
    as: 'status',
    attributes: {
      exclude: ['active'],
    },
  },
];
const excludedAgreementAttributes = ['primary_agreement_holder_id', 'agreement_type_id', 'zone_id',
  'extension_id', 'status_id'];

// Create agreement
router.post('/', asyncMiddleware(async (req, res) => {
  res.status(501).json({ error: 'Not Implemented' }).end();
}));

// Get all
router.get('/', asyncMiddleware(async (req, res) => {
  try {
    const agreements = await Agreement.findAll({
      include: allAgreementChildren,
      attributes: {
        exclude: excludedAgreementAttributes,
      },
    });

    res.status(200).json(agreements).end();
  } catch (err) {
    throw err;
  }
}));

// Update
router.put('/:id', asyncMiddleware(async (req, res) => {
  const {
    id,
  } = req.params;
  const {
    body,
  } = req;

  try {
    const count = await Agreement.update(body, {
      where: {
        id,
      },
    });

    if (count[0] === 0) {
      // No records were updated. The ID probably does not exists.
      return res.send(400).end(); // Bad Request
    }

    const agreement = await Agreement.findOne({
      where: {
        id,
      },
      include: allAgreementChildren,
      attributes: {
        exclude: excludedAgreementAttributes,
      },
    });

    return res.status(200).json(agreement).end();
  } catch (error) {
    logger.error(`error updating agreement ${id}`);
    throw error;
  }
}));

// Get by id
router.get('/:id', asyncMiddleware(async (req, res) => {
  try {
    const {
      id,
    } = req.params;

    const agreement = await Agreement.findOne({
      where: {
        id,
      },
      include: allAgreementChildren,
      attributes: {
        exclude: excludedAgreementAttributes,
      },
    });

    if (agreement != null) {
      res.status(200).json(agreement).end();
    } else {
      res.status(404).json({ error: 'Not found' }).end();
    }
  } catch (err) {
    throw err;
  }
}));

//
// Agreement Status
//

// Update the status of an agreement
router.put('/:agreementId?/status/:statusId?', asyncMiddleware(async (req, res) => {
  const {
    agreementId,
    statusId,
  } = req.params;

  if ((!agreementId || !statusId) || (!isNumeric(agreementId) || !isNumeric(statusId))) {
    throw errorWithCode('Both agreementId and statusId must be provided and be numeric', 400);
  }

  try {
    const agreement = await Agreement.findById(agreementId);
    if (!agreement) {
      throw errorWithCode(`No Agreement with ID ${agreementId} exists`, 400);
    }

    const status = await AgreementStatus.findOne({
      where: {
        id: statusId,
      },
      attributes: {
        exclude: ['updatedAt', 'createdAt', 'active'],
      },
    });
    if (!status) {
      throw errorWithCode(`No Status with ID ${statusId} exists`, 400);
    }

    await agreement.setStatus(status);

    return res.status(200).json(status).end();
  } catch (err) {
    throw err;
  }
}));

//
// Agreement Zone
//

// Update the zone of an agreement
router.put('/:agreementId?/zone/:zoneId?', asyncMiddleware(async (req, res) => {
  const {
    agreementId,
    zoneId,
  } = req.params;

  if (!agreementId || !zoneId || !isNumeric(agreementId) || !isNumeric(zoneId)) {
    throw errorWithCode('Both agreementId and zoneId must be provided and be numaric', 400);
  }

  try {
    const agreement = await Agreement.findById(agreementId);
    if (!agreement) {
      throw errorWithCode(`No Agreement with ID ${agreementId} exists`, 400);
    }

    const zone = await Zone.findOne({
      where: {
        id: zoneId,
      },
      attributes: {
        exclude: ['updatedAt', 'createdAt'],
      },
    });

    await agreement.setZone(zone);
    return res.status(200).json(zone).end();
  } catch (err) {
    throw err;
  }
}));

//
// Agreement Livestock Identifier
//

// get livestock identifiers of an agreement
router.get('/:agreementId?/livestockIdentifier', asyncMiddleware(async (req, res) => {
  const {
    agreementId,
  } = req.params;

  if (!agreementId || !isNumeric(agreementId)) {
    throw errorWithCode('agreementId must be provided and be numaric', 400);
  }

  try {
    const livestockIdentifiers = await LivestockIdentifier.findAll({
      where: {
        agreementId,
      },
    });

    return res.status(200).json(livestockIdentifiers).end();
  } catch (err) {
    throw err;
  }
}));

export default router;
