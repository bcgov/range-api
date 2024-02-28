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

import { asyncMiddleware } from '@bcgov/nodejs-common-utils';
import { Router } from 'express';
import config from '../../config';
import DataManager from '../../libs/db2';

const dm = new DataManager(config);
const { db, District } = dm;

const router = new Router();

// Get all
router.get(
  '/',
  asyncMiddleware(async (req, res) => {
    try {
      const results = await District.find(db, {});
      res.status(200).json(results).end();
    } catch (err) {
      res.status(500).json({ error: err }).end();
    }
  }),
);

module.exports = router;
