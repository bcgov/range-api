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
/* eslint-disable function-paren-newline */

'use strict';

import { asyncMiddleware, errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { Router } from 'express';
import { flatten } from 'lodash';
import config from '../../config';
import DataManager from '../../libs/db2';
import { isNumeric } from '../../libs/utils';

const router = new Router();
const dm2 = new DataManager(config);
const {
  db,
  Agreement,
  Client,
  Zone,
  ClientAgreement,
} = dm2;

const allowableIDsForUser = async (user, agreementIDs) => {
  let okIDs = [];
  if (user.isAgreementHolder()) {
    const clientIds = await user.getLinkedClientIds(db);

    const clientAgreements = await ClientAgreement.find(db, { client_id: clientIds });
    const allowableAgreementIds = clientAgreements.map(
      clientAgreement => clientAgreement.agreementId,
    );

    okIDs = agreementIDs.filter(id => allowableAgreementIds.includes(id));
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
    const zones = await Zone.findWithDistrictUser(db, { user_id: user.id });
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

const getAgreeementsForAH = async ({
  page = undefined, limit = undefined, orderBy = 'agreement.forest_file_id', order = 'asc',
  user, latestPlan = true, sendFullPlan = false, staffDraft = false,
}) => {
  const clientIds = await user.getLinkedClientIds(db);

  const clientAgreements = await ClientAgreement.find(db, { client_id: clientIds });
  const agreementIds = clientAgreements.map(clientAgreement => clientAgreement.agreementId);

  const agreements = await Agreement.findWithAllRelations(
    db, { forest_file_id: agreementIds }, page, limit, latestPlan, sendFullPlan, staffDraft, orderBy, order,
  );
  return agreements;
};

const getAgreementsForRangeOfficer = async ({
  page = undefined, limit = undefined, orderBy = 'agreement.forest_file_id', order = 'asc',
  user, latestPlan = false, sendFullPlan = true, staffDraft = true,
}) => {
  const zones = await Zone.findWithDistrictUser(db, { user_id: user.id });
  const ids = zones.map(zone => zone.id);
  const agreements = await Agreement.findWithAllRelations(
    db, { zone_id: ids }, page, limit, latestPlan, sendFullPlan, staffDraft, orderBy, order,
  );

  return agreements;
};

const getAgreementsForAdmin = async ({
  page = undefined, limit = undefined, orderBy = 'agreement.forest_file_id', order = 'asc',
  latestPlan = true, sendFullPlan = false, staffDraft = true,
}) => {
  const agreements = await Agreement.findWithAllRelations(
    db, { }, page, limit, latestPlan, sendFullPlan, staffDraft, orderBy, order,
  );
  return agreements;
};

//
// Routes
//

// Get all agreements based on the user type. This is only used by IOS
router.get('/', asyncMiddleware(async (req, res) => {
  try {
    const { user } = req;
    let results = [];

    if (user.isAgreementHolder()) {
      results = await getAgreeementsForAH({ user });
    } else if (user.isRangeOfficer()) {
      results = await getAgreementsForRangeOfficer({ user });
    } else if (user.isAdministrator()) {
      throw errorWithCode('This endpoint is forbidden for the admin user', 401);
      // results = await getAgreementsForAdmin({});
    } else {
      throw errorWithCode('Unable to determine user roll', 500);
    }

    if (results.length > 0) {
      results.map(agreement => agreement.transformToV1());
    }
    return res.status(200).json(results).end();
  } catch (err) {
    throw err;
  }
}));

// Search agreements by RAN, contact name, and client name. This is only used by Web
router.get('/search', asyncMiddleware(async (req, res) => {
  const { user, query } = req;
  const { term = '', orderBy = 'agreement.forest_file_id', order = 'asc' } = query;

  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  let agreements = [];
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

      // remove duplicate ids
      const nonDuplicateIDs = allIDs.filter((v, i) => allIDs.indexOf(v) === i);

      const okIDs = await allowableIDsForUser(req.user, nonDuplicateIDs);
      totalItems = okIDs.length;

      const latestPlan = true;
      const sendFullPlan = false;
      const staffDraft = !user.isAgreementHolder();
      agreements = await Agreement.findWithAllRelations(
        db, { forest_file_id: okIDs }, page, limit,
        latestPlan, sendFullPlan, staffDraft, orderBy, order,
      );
    } else {
      const count = await agreementCountForUser(req.user);

      if (user.isAgreementHolder()) {
        agreements = await getAgreeementsForAH({ user, page, limit, orderBy, order });
      } else if (user.isRangeOfficer()) {
        agreements = await getAgreementsForRangeOfficer({
          user,
          page,
          limit,
          sendFullPlan: false,
          orderBy,
          order,
        });
      } else if (user.isAdministrator()) {
        agreements = await getAgreementsForAdmin({ page, limit, orderBy, order });
      } else {
        throw errorWithCode('Unable to determine user role', 500);
      }
      totalItems = count;
    }

    agreements.map(agreement => agreement.transformToV1());

    // Make sure the user param supplied is not more than the actual total
    // pages.
    const totalPages = Math.ceil(totalItems / limit) || 1;
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

// Get a single agreement by id. This is only used for Web
router.get('/:id', asyncMiddleware(async (req, res) => {
  const { user, params, query } = req;
  const { id } = params;
  const { latestPlan = false, sendFullPlan = false } = query;

  try {
    // TODO:(jl) Confirm role(s) / access before proceeding with request.
    const staffDraft = !user.isAgreementHolder();
    const results = await Agreement
      .findWithAllRelations(db, { forest_file_id: id }, null, null,
        latestPlan, sendFullPlan, staffDraft);
    if (results.length === 0) {
      throw errorWithCode(`Unable to find agreement with ID ${id}`, 404);
    }

    const agreement = results.pop();

    if (!(await req.user.canAccessAgreement(db, agreement))) {
      throw errorWithCode('You do not access to this agreement', 403);
    }
    agreement.transformToV1();
    res.status(200).json(agreement).end();
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
      throw errorWithCode(`Unable to find agreement ${id}`, 404);
    }

    const agreement = results.pop();

    if (!(await user.canAccessAgreement(db, agreement))) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    const pkeys = await Agreement.update(db, { forest_file_id: id }, body);
    if (pkeys.length === 0) {
      throw errorWithCode('There was a problem updating the record', 400);
    }

    const agreements = pkeys.map(pkey => Agreement.find(db, { forest_file_id: pkey }));

    res.status(200).json(await Promise.all(agreements)).end();
  } catch (error) {
    logger.error(`logging: error updating agreement ${id}, error = ${error.message}`);
    throw error;
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
      throw errorWithCode('Unable to find agreement', 404);
    }

    const agreement = results.pop();

    if (!(await user.canAccessAgreement(db, agreement))) {
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
    throw error;
  }
}));

export default router;
