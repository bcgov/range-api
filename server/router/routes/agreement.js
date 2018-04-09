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
import { Op } from 'sequelize';
import {
  asyncMiddleware,
  errorWithCode,
  isNumeric,
} from '../../libs/utils';
import { logger } from '../../libs/logger';
import config from '../../config';
import DataManager from '../../libs/db';
import Includes from './includes';

const router = new Router();
const dm = new DataManager(config);
const {
  ClientType,
  Agreement,
  Zone,
  LivestockIdentifier,
} = dm;

const {
  STANDARD_INCLUDE_NO_ZONE,
  EXCLUDED_AGREEMENT_ATTR,
  INCLUDE_ZONE_MODEL,
  INCLUDE_DISTRICT_MODEL,
} = new Includes(dm);

//
// Helpers
//

/**
 * Transform a client object to the format apropriate for the API spec
 *
 * @param {[Client]} clients The agreement object containing the clients
 * @param {[ClientType]} clientTypes The client type reference objects
 * @returns Array of plain (JSON) client objects
 */
const transformClients = (clients, clientTypes) => {
  const results = clients
    .map((c) => {
      const client = c.get({ plain: true });
      const ctype = clientTypes.find(t => t.id === c.clientAgreement.clientTypeId);
      delete client.clientAgreement;
      return Object.assign(client, { clientTypeCode: ctype.code });
    })
    .sort((a, b) => a.clientTypeCode > b.clientTypeCode);

  return results;
};

/**
 * Add `Zone` filtering by userId accounting for Administrative privledges.
 *
 * @param {User} user The user to filter on.
 * @returns The `Zone` with the apropriate filtering via the where clause.
 */
const filterZonesOnUser = (user) => {
  if (!user.isAdministrator()) {
    return Object.assign(INCLUDE_ZONE_MODEL, { where: { userId: user.id } });
  }

  return INCLUDE_ZONE_MODEL;
};

/**
 * Transform the structure of an Agreement to match the API spec
 *
 * @param {Agreement} agreement The agreement object containing the clients
 * @param {[ClientType]} clientTypes The client type reference objects
 * @returns A plain (JSON) Agreement object
 */
const transformAgreement = (agreement, clientTypes) => {
  const transformedClients = transformClients(agreement.clients, clientTypes);
  const agreementAsJSON = agreement.get({ plain: true });
  agreementAsJSON.clients = transformedClients;

  return agreementAsJSON;
};

//
// Routes
//

// Get all agreements
router.get('/', asyncMiddleware(async (req, res) => {
  const { term = '', limit = 10, page } = req.query;

  const offset = page ? limit * (page - 1) : 0;
  const where = {
    [Op.or]: [
      {
        id: {
          [Op.iLike]: `%${term}%`, // (iLike: case insensitive)
        },
      },
    ],
  };

  try {
    const clientTypes = await ClientType.findAll();
    const agreements = await Agreement.findAll({
      limit,
      offset,
      include: STANDARD_INCLUDE_NO_ZONE.concat(filterZonesOnUser(req.user)),
      attributes: {
        exclude: EXCLUDED_AGREEMENT_ATTR,
      },
      where,
    });
    // apply and transforms to the data structure.
    const transformedAgreements = agreements.map(result => transformAgreement(result, clientTypes));

    let result;
    if (page) {
      // Its a bit tough to get the count from Sequlize but a raw query works great. A where clause
      // is applied only if the user is not an administrator.
      let query = 'SELECT count(*) FROM agreement JOIN ref_zone ON agreement.zone_id = ref_zone.id';
      if (!req.user.isAdministrator()) {
        query = `${query} WHERE ref_zone.user_id = ${req.user.id}`;
      }
      const [response] = await dm.sequelize.query(query, { type: dm.sequelize.QueryTypes.SELECT });
      const { count: totalCount = 0 } = response;

      result = {
        perPage: limit,
        currentPage: Number(page),
        totalPage: Math.ceil(totalCount / limit) || 1,
        agreements: transformedAgreements,
      };
    } else {
      result = transformedAgreements;
    }

    res.status(200).json(result).end();
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
      include: STANDARD_INCLUDE_NO_ZONE.concat(filterZonesOnUser(req.user)),
      attributes: {
        exclude: EXCLUDED_AGREEMENT_ATTR,
      },
    });

    if (agreement) {
      const plainAgreement = transformAgreement(agreement, clientTypes);
      res.status(200).json(plainAgreement).end();
    } else {
      res.status(404).json({ error: 'Not found' }).end();
    }
  } catch (err) {
    throw err;
  }
}));

// Update
// can probably be removed nothing in the Agreement should be updated directly. Expose
// new endpoint for exemtpin status (check with list).
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
      include: STANDARD_INCLUDE_NO_ZONE.concat(INCLUDE_ZONE_MODEL), // no filtering for now.
      attributes: {
        exclude: EXCLUDED_AGREEMENT_ATTR,
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

    const plainAgreement = transformAgreement(agreement, clientTypes);

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
      include: [INCLUDE_DISTRICT_MODEL],
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
