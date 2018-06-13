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
import { flatten } from 'lodash';
import config from '../../config';
import DataManager from '../../libs/db2';
import { logger } from '../../libs/logger';
import { asyncMiddleware, errorWithCode, isNumeric } from '../../libs/utils';

const router = new Router();
const dm2 = new DataManager(config);
const {
  db,
  Agreement,
  Client,
  Zone,
} = dm2;

const allowableIDsForUser = async (user, agreementIDs) => {
  let okIDs = [];
  if (user.isAgreementHolder()) {
    const myIDs = await Agreement.agreementsForClientId(db, user.clientId);
    okIDs = agreementIDs.filter(id => myIDs.includes(id));
  } else if (user.isRangeOfficer()) {
    const zones = await Zone.find(db, { user_id: user.id });
    const zpromise = zones.map(zone => Agreement.agreementsForZoneId(db, zone.id));
    const myIDs = flatten(await Promise.all(zpromise));
    okIDs = agreementIDs.filter(id => myIDs.includes(id));
  } else {
    okIDs = agreementIDs;
  }

  return okIDs;
};

const agreementCountForUser = async (user) => {
  let count = 0;
  if (user.isAgreementHolder()) {
    const ids = await Agreement.agreementsForClientId(db, user.clientId);
    count = ids.length;
  } else if (user.isRangeOfficer()) {
    const zones = await Zone.findWithDistrictUser(db, { user_id: 34 });
    const zids = zones.map(zone => zone.id);
    const ids = await Agreement.find(db, { zone_id: zids });
    count = ids.length;
  } else if (user.isAdministrator()) {
    count = await Agreement.count(db);
  } else {
    throw errorWithCode('Unable to determine user roll', 500);
  }

  return count;
};

const agreementsForUser = async (user, page = undefined, limit = undefined) => {
  let results = [];
  // TODO:(jl) findWithAllRelations is a pretty hevy weight query. Consider
  // giving just base agreement details and let the clients pull in the
  // `Plan` later.

  if (user.isAgreementHolder()) {
    const ids = await Agreement.agreementsForClientId(db, user.clientId);
    results = await Agreement.findWithAllRelations(db, { forest_file_id: ids }, page, limit);
  } else if (user.isRangeOfficer()) {
    const zones = await Zone.findWithDistrictUser(db, { user_id: user.id });
    const ids = zones.map(zone => zone.id);
    // send the latest plan which carrys the whole information for each agreement to the staff
    results = await Agreement.findWithAllRelations(db, { zone_id: ids }, page, limit, true, true);
  } else if (user.isAdministrator()) {
    results = await Agreement.findWithAllRelations(db, { }, page, limit);
  } else {
    throw errorWithCode('Unable to determine user roll', 500);
  }

  return results;
};

//
// Routes
//

// Get all agreements based on the user type
router.get('/', asyncMiddleware(async (req, res) => {
  try {
    const results = await agreementsForUser(req.user);

    if (results.length > 0) {
      results.map(agreement => agreement.transformToV1());
    }
    return res.status(200).json(results).end();
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
  let agreements = [];
  let totalPages = 0;
  let totalItems = 0;

  try {
    if (term) {
      const clientIDs = await Client.searchForTerm(db, term);
      const cpromises = clientIDs.map(clientId => Agreement.agreementsForClientId(db, clientId));
      const zoneIDs = await Zone.searchForTerm(db, term);
      const zpromises = zoneIDs.map(zoneId => Agreement.agreementsForZoneId(db, zoneId));
      const allIDs = flatten([
        ...(await Agreement.searchForTerm(db, term)),
        ...(await Promise.all(cpromises)),
        ...(await Promise.all(zpromises)),
      ]);

      const okIDs = await allowableIDsForUser(req.user, allIDs);

      totalPages = Math.ceil(okIDs.length / limit) || 1;
      totalItems = okIDs.length;

      const promises = okIDs
        .slice(offset, offset + limit)
        .map(agreementId =>
          Agreement.findWithAllRelations(db, { forest_file_id: agreementId }));
      agreements = flatten(await Promise.all(promises));
    } else {
      const count = await agreementCountForUser(req.user);
      agreements = await agreementsForUser(req.user, page, limit);
      totalPages = Math.ceil(count / limit) || 1;
      totalItems = count;
    }

    agreements.map(agreement => agreement.transformToV1());

    // Make sure the user param supplied is not more than the actual total
    // pages.
    const currentPage = page > totalPages ? totalPages : page;
    const result = {
      perPage: limit,
      currentPage,
      totalItems,
      totalPages,
      agreements,
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

    if (results.length === 0) {
      throw errorWithCode(`Unable to find agreement with ID ${id}`, 404);
    }

    const agreement = results.pop();

    if (!req.user.canAccessAgreement(agreement.pop())) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    return res.status(200).json(agreement.transformToV1()).end();
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
      { zoneId: body.zoneId },
    );

    if (pkeys.length === 0) {
      throw errorWithCode('There was a problem updating the record', 400);
    }

    const agreements = pkeys.map(pkey => Agreement.findWithAllRelations(
      db,
      { forest_file_id: pkey },
    ));
    const theAgreements = flatten(await Promise.all(agreements));

    res.status(200).json(theAgreements.pop().zone).end();
  } catch (error) {
    logger.error(`error updating agreement ${agreementId}, error = ${error.message}`);
    throw errorWithCode('There was a problem updating the record', 500);
  }
}));

export default router;
