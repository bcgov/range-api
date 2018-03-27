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
// import deepDiff from 'deep-diff';
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
  Zone,
  District,
  LivestockIdentifier,
  LivestockIdentifierLocation,
  LivestockIdentifierType,
  Pasture,
  Plan,
  PlanStatus,
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
    model: Plan,
    attributes: {
      exclude: ['status_id'],
    },
    include: [{
      model: PlanStatus,
      as: 'status',
    }, {
      model: Pasture,
      attributes: {
        exclude: ['plan_id'],
      },
      // include: [{
      //   model: PlantCommunity,
      //   attributes: {
      //     exclude: ['aspect_id', 'elevation_id', 'pasture_id'],
      //   },
      //   include: [{
      //       model: PlantCommunityAspect,
      //       as: 'aspect'
      //     }, {
      //       model: PlantCommunityElevation,
      //       as: 'elevation'
      //     },
      //     {
      //       model: PlantCommunityAction,
      //       as: 'actions',
      //       attributes: {
      //         exclude: ['plant_community_id'],
      //       },
      //       include: [{
      //         model: PlantCommunityActionPurpose,
      //         as: 'actionPurpose'
      //       },
      //       {
      //         model: PlantCommunityActionType,
      //         as: 'actionType'
      //       }],
      //     }
      //   ],
      // }],
    },
    {
      model: GrazingSchedule,
      include: [{
        model: GrazingScheduleEntry,
        include: [LivestockType, Pasture],
        attributes: {
          exclude: ['grazing_schedule_id', 'livestock_type_id', 'plan_grazing_schedule'],
        },
      }],
    },
    ],
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
];
const excludedAgreementAttributes = ['agreement_type_id', 'agreement_exemption_status_id'];

// Create agreement
router.post('/', asyncMiddleware(async (req, res) => {
  res.status(501).json({ error: 'Not Implemented' }).end();
}));

// Get all
router.get('/', asyncMiddleware(async (req, res) => {
  try {
    const agreements = await Agreement.findAll({
      limit: 100,
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
    const agreement = await Agreement.findOne({
      where: {
        id,
      },
      include: allAgreementChildren,
      attributes: {
        exclude: excludedAgreementAttributes,
      },
    });

    if (!agreement) {
      res.status(404).end();
    }

    /* const changes = deepDiff.diff(
      agreement.get({ plain: true }),
      agreement2.get({ plain: true })
    );

    if (changes) {
      res.status(200).json([agreement, agreement2, changes]).end();
    } */

    const count = await Agreement.update(body, {
      where: {
        id,
      },
    });

    if (count[0] === 0) {
      // No records were updated. The ID probably does not exists.
      res.send(400).json().end(); // Bad Request
    }

    res.status(200).json(agreement).end();
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
// Agreement Zone
//

// Update the zone of an agreement
router.put('/:agreementId?/zone', asyncMiddleware(async (req, res) => {
  const {
    zoneId,
  } = req.body;
  const {
    agreementId,
  } = req.params;

  if (!zoneId || !isNumeric(zoneId)) {
    throw errorWithCode('zoneId must be provided in body and be numeric', 400);
  }

  if (!agreementId) {
    throw errorWithCode('agreementId must be provided in path', 400);
  }

  try {
    const agreement = await Agreement.findById(agreementId);
    if (!agreement) {
      throw errorWithCode(`No Agreement with ID ${agreementId} exists`, 404);
    }

    const zone = await Zone.findOne({
      where: {
        id: zoneId,
      },
      attributes: {
        exclude: ['updatedAt', 'createdAt'],
      },
    });
    if (!zone) {
      throw errorWithCode(`No Zone with ID ${zoneId} exists`, 404);
    }

    await agreement.setZone(zone);
    return res.status(200).json(zone).end();
  } catch (err) {
    throw err;
  }
}));

//
// Agreement Livestock Identifier
//

// create a livestock identifier in an agreement
router.post('/:agreementId?/livestockidentifier', asyncMiddleware(async (req, res) => {
  res.status(501).json({ error: 'not implemented yet' }).end();

  const {
    agreementId,
  } = req.params;

  if (!agreementId) {
    throw errorWithCode('agreementId must be provided in path', 400);
  }

  const {
    body,
  } = req;

  // TODO: validate fields in body
  try {
    const agreement = await Agreement.findOne({
      where: {
        agreementId,
      },
    });

    const livestockIdentifier = await LivestockIdentifier.create(body);

    await agreement.addLivestockIdentifier(livestockIdentifier);
    await agreement.save();

    res.status(200).json(livestockIdentifier).end();
  } catch (err) {
    throw err;
  }
}));

// get all livestock identifiers of an agreement
router.get('/:agreementId?/livestockidentifier', asyncMiddleware(async (req, res) => {
  const {
    agreementId,
  } = req.params;

  if (!agreementId) {
    throw errorWithCode('agreementId must be provided in path', 400);
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

router.put('/:agreementId?/livestockidentifier/:livestockIdentifierId?', asyncMiddleware(async (req, res) => {
  const {
    agreementId,
    livestockIdentifierId,
  } = req.params;

  const {
    body,
  } = req;

  if (!livestockIdentifierId || !isNumeric(livestockIdentifierId)) {
    throw errorWithCode('livestockIdentifierId must be provided and be numeric', 400);
  }

  if (!agreementId) {
    throw errorWithCode('agreementId must be provided in path', 400);
  }

  try {
    const [affectedCount] = await LivestockIdentifier.update(body, {
      where: {
        agreementId,
        id: livestockIdentifierId,
      },
    });

    if (!affectedCount) {
      throw errorWithCode(`No livestock identifier with ID ${livestockIdentifierId} exists`, 400);
    }

    const livestockIdentifier = await LivestockIdentifier.findOne({
      where: {
        id: livestockIdentifierId,
      },
      attributes: {
        exclude: ['updatedAt', 'createdAt'],
      },
    });

    return res.status(200).json(livestockIdentifier);
  } catch (err) {
    throw err;
  }
}));

export default router;
