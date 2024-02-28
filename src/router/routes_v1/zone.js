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
// Created by Jason Leach on 2018-01-18.
//

/* eslint-env es6 */

'use strict';

import { asyncMiddleware, errorWithCode } from '@bcgov/nodejs-common-utils';
import { Router } from 'express';
import config from '../../config';
import DataManager from '../../libs/db2';
import { isNumeric, checkRequiredFields } from '../../libs/utils';

const dm = new DataManager(config);
const { db, Zone, User } = dm;

const router = new Router();

// Get the Zones for a given District.
router.get(
  '/',
  asyncMiddleware(async (req, res) => {
    const { districtId } = req.query;

    // `District` is publically available information. If we choose it
    // can be served without access control.

    try {
      let where = {};
      if (districtId) {
        where = { district_id: districtId };
      }
      const zones = await Zone.findWithDistrictUser(db, where);

      res.status(200).json(zones).end();
    } catch (error) {
      throw error;
    }
  }),
);

// Get the user associated with a specific zone.
router.put(
  '/:zoneId/user',
  asyncMiddleware(async (req, res) => {
    const { body, params } = req;
    const { zoneId } = params;
    const { userId } = body;

    checkRequiredFields(['userId'], 'body', req);

    checkRequiredFields(['zoneId'], 'params', req);

    if (!isNumeric(zoneId) || !isNumeric(userId)) {
      throw errorWithCode('The zone and user ID must be numeric', 400);
    }

    try {
      const zone = await Zone.findById(db, zoneId);
      if (!zone) {
        throw errorWithCode(`No Zone with ID ${zoneId} exists`, 404);
      }

      await Zone.update(db, { id: parseInt(zoneId, 10) }, { user_id: userId });
      const user = await User.update(
        db,
        { id: userId },
        {
          active: true,
        },
      );

      res.status(200).json(user).end();
    } catch (err) {
      throw err;
    }
  }),
);

module.exports = router;
