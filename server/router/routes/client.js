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

'use strict';

import { Router } from 'express';
import config from '../../config';
import DataManager from '../../libs/db2';
import { asyncMiddleware, errorWithCode } from '../../libs/utils';

const dm = new DataManager(config);
const {
  db,
  Client,
} = dm;

const router = new Router();

// Get all clients
router.get('/', asyncMiddleware(async (req, res) => {
  try {
    if (req.user && req.user.isAgreementHolder()) {
      throw errorWithCode('Unauthorized', 401);
    }

    const results = await Client.find(db, {});
    res.status(200).json(results).end();
  } catch (err) {
    throw err;
  }
}));

// Search clients
router.get('/search', asyncMiddleware(async (req, res) => {
  const { term = '' } = req.query;

  try {
    if (req.user && req.user.isAgreementHolder()) {
      throw errorWithCode('Unauthorized', 401);
    }

    const results = await Client.searchByNameWithAllFields(db, term);
    res.status(200).json(results).end();
  } catch (err) {
    throw err;
  }
}));

// Get by id
router.get('/:clientId', asyncMiddleware(async (req, res) => {
  const {
    clientId,
  } = req.params;

  try {
    if (req.user && req.user.isAgreementHolder()) {
      throw errorWithCode('Unauthorized', 401);
    }

    const results = await Client.find(db, { client_number: clientId });
    if (results.length === 0) {
      res.status(404).json({ error: 'Not found' }).end();
    }

    res.status(200).json(results.pop()).end();
  } catch (err) {
    throw err;
  }
}));

module.exports = router;
