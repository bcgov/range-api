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
import { asyncMiddleware } from '../../libs/utils';
import config from '../../config';
import DataManager from '../../libs/db';

const dm = new DataManager(config);
const {
  AgreementStatus,
  AgreementType,
  LivestockType,
} = dm;

const router = new Router();

// Get all
router.get('/', asyncMiddleware(async (req, res) => {
  try {
    const opts = {
      where: {
        active: true,
      },
      attributes: {
        exclude: ['updatedAt', 'createdAt', 'active'],
      },
    };

    const ags = await AgreementStatus.findAll(opts);
    const agt = await AgreementType.findAll(opts);
    const lty = await LivestockType.findAll(opts);

    const response = {
      AGREEMENT_STATUS: ags || { error: 'Unable to fetch reference data' },
      AGREEMENT_TYPE: agt,
      LIVESTOCK_TYPE: lty,
    };

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ error: err }).end();
  }
}));

export default router;
