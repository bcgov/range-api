
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

/* eslint-env es6 */

'use strict';

import { asyncMiddleware, errorWithCode } from '@bcgov/nodejs-common-utils';
import { Router } from 'express';
import request from 'request-promise-native';
import passport from 'passport';
import config from '../../config';
import DataManager from '../../libs/db2';
import { ENVIRONMENTS, API_URL } from '../../constants';

const router = new Router();
const dm = new DataManager(config);
const {
  db,
  Version,
} = dm;

// Get versions of the ios app and api
router.get('/', asyncMiddleware(async (req, res) => {
  try {
    const version = await Version.findOne(db, {});

    res.status(200).json(version).end();
  } catch (error) {
    throw error;
  }
}));

router.use(passport.authenticate('jwt', { session: false }));
router.put('/', asyncMiddleware(async (req, res) => {
  try {
    const { user, body } = req;
    const {
      idpHint,
      api,
      ios,
    } = body;

    if (user && !user.isAdministrator()) {
      throw errorWithCode('Only Admin have the permission for this request', 403);
    }

    const updated = await Version.update(db, { }, {
      idpHint,
      api,
      ios,
    });

    // update test and dev environments as well
    if (process.env.NODE_ENV === ENVIRONMENTS.PRODUCTION) {
      const opt = {
        url: `${API_URL.DEV}/v1/version`,
        method: 'PUT',
        json: { idpHint, api, ios },
      };
      await request(opt);
      opt.url = `${API_URL.TEST}/v1/version`;
      await request(opt);
    }

    res.status(200).json(updated).end();
  } catch (error) {
    throw error;
  }
}));

module.exports = router;
