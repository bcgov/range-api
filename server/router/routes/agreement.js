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
import DataManager from '../../libs/db2';
import { logger } from '../../libs/logger';
import { asyncMiddleware, errorWithCode, isNumeric } from '../../libs/utils';

const router = new Router();
const dm2 = new DataManager(config);
const {
  db,
  Agreement,
} = dm2;

//
// Routes
//

// Get all agreements based on the user type
router.get('/', asyncMiddleware(async (req, res) => {
  try {
    // TODO:(jl) Confirm role(s) / access before proceeding with request.
    // TODO:(jl) This is a pretty hevy weight query. Consider giving just
    // base agreement details and let the clients pull in the `Plan` later.
    const results = await Agreement.findWithAllRelations(db, { });

    if (results.length > 0) {
      results.map(agreement => agreement.transformToV1());

      return res.status(200).json(results).end();
    }

    return res.status(404).json({ error: 'Not found' }).end();
  } catch (err) {
    throw err;
  }
}));

// Search agreements by RAN, contact name, and client name.
router.get('/search', asyncMiddleware(async (req, res) => {
  // const { term = '', limit: l = 10, page: p = 1 } = req.query;
  // const page = Number(p);
  // const limit = Number(l);
  // const offset = limit * (page - 1);

  try {
    // const results = await Agreement.findWithAllRelations(db, { });

    // Agreements where
    // User (first / last || first last) match term
    // AgreementID matches term.
    // Client name matches term.

    // .filter((zone) => {
    //   const rx = new RegExp(`(?=.*${zone.user.givenName})|(?=.*${zone.user.familyName})`, 'ig');
    //   return rx.test(term);
    // })
    // .map(zone => zone.code);

    // const m = results.filter((result) => {

    // });

    const [totalCount, limit, page] = 0;
    const transformedAgreements = [];
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
  const {
    id,
  } = req.params;

  try {
    // TODO:(jl) Confirm role(s) / access before proceeding with request.
    const results = await Agreement.findWithAllRelations(db, { forest_file_id: id });

    if (results.length > 0) {
      const agreement = results.pop();
      agreement.transformToV1();

      return res.status(200).json(agreement).end();
    }

    return res.status(404).json({ error: 'Not found' }).end();
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
    user,
    body,
  } = req;

  delete body.forestFileId;
  delete body.createdAt;
  delete body.updatedAt;

  try {
    const results = await Agreement.find(db, { forest_file_id: id });

    if (results.length === 0) {
      throw errorWithCode('You do not access to this agreement', 400);
    }

    const agreement = results.pop();

    if (!user.canAccessAgreement(agreement)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    const pkeys = await Agreement.update(db, { forest_file_id: id }, body);
    if (pkeys.length === 0) {
      throw errorWithCode('There was a problem updating the record', 400);
    }

    const agreements = pkeys.map(pkey => Agreement.find(db, { forest_file_id: pkey }));

    res.status(200).json(await Promise.all(agreements)).end();
  } catch (error) {
    logger.error(`error updating agreement ${id}, error = ${error.message}`);
    throw errorWithCode('There was a problem updating the record', 500);
  }
}));

//
// Agreement Zone
//

// Update the zone of an agreement
router.put('/:agreementId?/zone', asyncMiddleware(async (req, res) => {
  const {
    agreementId,
  } = req.params;
  const {
    user,
    body,
  } = req;

  if (!body.zoneId || !isNumeric(body.zoneId)) {
    throw errorWithCode('zoneId must be provided in body and be numeric', 400);
  }

  if (!agreementId) {
    throw errorWithCode('agreementId must be provided in path', 400);
  }

  try {
    const results = await Agreement.find(db, { forest_file_id: agreementId });

    if (results.length === 0) {
      throw errorWithCode('You do not access to this agreement', 400);
    }

    const agreement = results.pop();

    if (!user.canAccessAgreement(agreement)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    const pkeys = await Agreement.update(
      db,
      { forest_file_id: agreementId },
      { zone_id: body.zoneId },
    );

    if (pkeys.length === 0) {
      throw errorWithCode('There was a problem updating the record', 400);
    }

    const agreements = pkeys.map(pkey => Agreement.find(db, { forest_file_id: pkey }));

    res.status(200).json(await Promise.all(agreements)).end();
  } catch (error) {
    logger.error(`error updating agreement ${agreementId}, error = ${error.message}`);
    throw errorWithCode('There was a problem updating the record', 500);
  }
}));

export default router;
