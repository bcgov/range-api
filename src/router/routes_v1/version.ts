// @ts-nocheck
//
// MYRA
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
// Created by Kyubin Han.
//

'use strict';

import { errorWithCode } from '../../libs/bcgov-shim.js';
import { Router } from 'express';
import passport from 'passport';
import config from '../../config/index.js';
import DataManager from '../../libs/db2/index.js';
import { ENVIRONMENTS, API_URL } from '../../constants.js';

const router = new Router();
const dm = new DataManager(config);
const { db, Version } = dm;

// Get versions of the ios app and api
router.get('/', async (req, res) => {
  const version = await Version.findOne(db, {});
  res.status(200).json(version).end();
});

router.use(passport.authenticate('jwt', { session: false }));
router.put('/', async (req, res) => {
  const { user, body } = req;
  const { idpHint, api, ios } = body;

  if (user && !user.isAdministrator()) {
    throw errorWithCode('Only Admin have the permission for this request', 403);
  }

  const updated = await Version.update(
    db,
    {},
    {
      idpHint,
      api,
      ios,
    },
  );

  // update test and dev environments as well
  if (process.env.NODE_ENV === ENVIRONMENTS.PRODUCTION) {
    const body = JSON.stringify({ idpHint, api, ios });
    const headers = { 'Content-Type': 'application/json' };
    await fetch(`${API_URL.DEV}/v1/version`, { method: 'PUT', headers, body });
    await fetch(`${API_URL.TEST}/v1/version`, { method: 'PUT', headers, body });
  }

  res.status(200).json(updated).end();
});

export default router;
