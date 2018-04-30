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

const router = new Router();
const dm = new DataManager(config);
const {
  ClientType,
  Agreement,
  Zone,
  transformAgreement,
  LivestockIdentifier,
  STANDARD_INCLUDE_NO_ZONE,
  STANDARD_INCLUDE_NO_ZONE_CLIENT,
  INCLUDE_ZONE_MODEL,
  INCLUDE_DISTRICT_MODEL,
  INCLUDE_USER_MODEL,
  INCLUDE_CLIENT_MODEL,
  EXCLUDED_AGREEMENT_ATTR,
} = dm;

//
// Routes
//

// Get all agreements based on the user type
router.get('/', asyncMiddleware(async (req, res) => {
  try {
    const options = {
      include: [...STANDARD_INCLUDE_NO_ZONE_CLIENT, INCLUDE_ZONE_MODEL(req.user),
        INCLUDE_CLIENT_MODEL(req.user)],
      attributes: {
        exclude: EXCLUDED_AGREEMENT_ATTR,
      },
      order: [
        ['plans', 'createdAt', 'DESC'],
      ],
    };
    const clientTypes = await ClientType.findAll();
    const agreements = await Agreement.findAll(options);

    // apply and transforms to the data structure.
    const transformedAgreements = agreements.map(result => transformAgreement(result, clientTypes));
    res.status(200).json(transformedAgreements).end();
  } catch (err) {
    throw err;
  }
}));

// Search agreements by RAN, contact name, and client name.
router.get('/search', asyncMiddleware(async (req, res) => {
  const { term = '', limit: l = 10, page: p = 1 } = req.query;
  const page = Number(p);
  const limit = Number(l);
  const offset = limit * (page - 1);

  try {
    // fetch all the zones where the User's first or last name matches the
    // search term.
    const codes = await Zone.findAll({
      where: {
        user_id: {
          [Op.ne]: null,
        },
      },
      include: [INCLUDE_USER_MODEL],
    })
      .filter((zone) => {
        const rx = new RegExp(`(?=.*${zone.user.givenName})|(?=.*${zone.user.familyName})`, 'ig');
        return rx.test(term);
      })
      .map(zone => zone.code);
    // This `where` clause will match the Agreement ID (forest file ID), or a Zone with
    // a matching User (see above), or a matching Client.
    const where = {
      [Op.or]: [
        {
          id: {
            [Op.iLike]: `%${term}%`, // (iLike: case insensitive)
          },
        },
        {
          '$zone.code$': codes, // limit scope of Zones
        },
        {
          '$clients.name$': {
            [Op.iLike]: `%${term}%`,
          },
        },
      ],
    };
    const clientTypes = await ClientType.findAll();
    const { count: totalCount, rows: agreements } = await Agreement.findAndCountAll({
      attributes: [
        dm.sequelize.literal('DISTINCT ON(forest_file_id) forest_file_id'),
        'id',
      ],
      include: [INCLUDE_CLIENT_MODEL(req.user), INCLUDE_ZONE_MODEL()],
      limit,
      offset,
      where,
      distinct: true, // get the distinct number of agreements
      subQuery: false, // prevent from putting LIMIT and OFFSET in sub query
    });

    // apply and transforms to the data structure.
    const transformedAgreements = await Promise.all(agreements.map(async (agreement) => {
      // Agreements from `findAndCountAll` dont' have a complete set of properties. We
      // fetch a fresh copy by ID to work around this.
      const myAgreement = await Agreement.findById(agreement.id, {
        attributes: {
          exclude: EXCLUDED_AGREEMENT_ATTR,
        },
        include: [...STANDARD_INCLUDE_NO_ZONE, INCLUDE_ZONE_MODEL()],
        order: [
          ['plans', 'createdAt', 'DESC'],
        ],
      });

      return { ...transformAgreement(myAgreement, clientTypes) };
    }));

    const result = {
      perPage: limit,
      currentPage: page,
      totalItems: totalCount,
      totalPage: Math.ceil(totalCount / limit) || 1,
      agreements: transformedAgreements,
    };

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
    const options = {
      where: {
        id,
      },
      include: [...STANDARD_INCLUDE_NO_ZONE_CLIENT, INCLUDE_ZONE_MODEL(req.user),
        INCLUDE_CLIENT_MODEL(req.user)],
      attributes: {
        exclude: EXCLUDED_AGREEMENT_ATTR,
      },
      order: [
        ['plans', 'createdAt', 'DESC'],
      ],
    };
    const clientTypes = await ClientType.findAll();
    const agreement = await Agreement.findOne(options);

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
    createdAt,
    updatedAt,
    ...body
  } = req.body;

  try {
    const clientTypes = await ClientType.findAll();
    const agreement = await Agreement.findOne({
      where: {
        id,
      },
      include: [...STANDARD_INCLUDE_NO_ZONE, INCLUDE_ZONE_MODEL()], // no filtering for now.
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

  // TODO: validate fields in body
  try {
    const agreement = await Agreement.findOne({
      where: {
        agreementId,
      },
    });
    const { createdAt, updatedAt, ...body } = req.body;
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
