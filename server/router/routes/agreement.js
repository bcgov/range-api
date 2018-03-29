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
  ClientType,
  ClientAgreement,
  Usage,
  Agreement,
  AgreementExemptionStatus,
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
    model: Client,
    through: {
      model: ClientAgreement,
      // include: [ClientType],
      attributes: ['clientTypeId'],
    },
    attributes: ['id', 'name', 'locationCode', 'startDate'],
  },
  {
    model: AgreementExemptionStatus,
    attributes: {
      exclude: ['active', 'createdAt', 'updatedAt'],
    },
  },
  {
    model: Zone,
    include: [{
      model: District,
      attributes: {
        exclude: ['createdAt', 'updatedAt'],
      },
    }],
    attributes: {
      exclude: ['district_id', 'districtId', 'createdAt', 'updatedAt'],
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
    model: Usage,
    as: 'usage',
    attributes: {
      exclude: ['agreement_id', 'agreementId', 'createdAt', 'updatedAt'],
    },
  },
];

const excludedAgreementAttributes = ['agreementTypeId', 'zoneId', 'agreementExemptionStatusId'];

//
// Helpers
//

/**
 * Transform a client object to the format apropriate for the API response.
 *
 * @param {Agreement} agreement The agreement object containing the clients
 * @param {[ClientType]} clientTypes The client type reference objects
 * @returns Array of plain (JSON) client Objects
 */
const transformClient = (agreement, clientTypes) => {
  const clients = agreement.clients.map((c) => {
    const client = c.get({ plain: true });
    const ctype = clientTypes.find(t => t.id === c.clientAgreement.clientTypeId);
    delete client.clientAgreement;
    return Object.assign(client, { clientTypeCode: ctype.code });
  });

  return clients;
};

//
// Routes
//

// Get all agreements
router.get('/', asyncMiddleware(async (req, res) => {
  try {
    const clientTypes = await ClientType.findAll();
    const results = await Agreement.findAll({
      limit: 10,
      include: allAgreementChildren,
      attributes: {
        exclude: excludedAgreementAttributes,
      },
    });

    // apply and transforms to the data structure.
    const agreements = results.map((result) => {
      const transformedClients = transformClient(result, clientTypes);
      const plainAgreement = result.get({ plain: true });
      plainAgreement.clients = transformedClients;

      return plainAgreement;
    });

    res.status(200).json(agreements).end();
  } catch (err) {
    throw err;
  }
}));

// Get a single agreement by id
router.get('/:id', asyncMiddleware(async (req, res) => {
  try {
    const {
      id,
    } = req.params;

    const clientTypes = await ClientType.findAll();
    const agreement = await Agreement.findOne({
      where: {
        id,
      },
      include: allAgreementChildren,
      attributes: {
        exclude: excludedAgreementAttributes,
      },
    });

    if (agreement) {
      const transformedClients = transformClient(agreement, clientTypes);
      const plainAgreement = agreement.get({ plain: true });
      plainAgreement.clients = transformedClients;

      res.status(200).json(plainAgreement).end();
    } else {
      res.status(404).json({ error: 'Not found' }).end();
    }
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
    const clientTypes = await ClientType.findAll();
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

    const count = await Agreement.update(body, {
      where: {
        id,
      },
    });

    if (count[0] === 0) {
      // No records were updated. The ID probably does not exists.
      res.send(400).json().end(); // Bad Request
    }

    const transformedClients = transformClient(agreement, clientTypes);
    const plainAgreement = agreement.get({ plain: true });
    plainAgreement.clients = transformedClients;

    res.status(200).json(plainAgreement).end();
  } catch (error) {
    logger.error(`error updating agreement ${id}`);
    throw error;
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
