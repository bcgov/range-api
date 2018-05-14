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
import { asyncMiddleware } from '../../libs/utils';

const dm = new DataManager(config);
const {
  db,
  AgreementType,
  AgreementExemptionStatus,
  ClientType,
  LivestockType,
  LivestockIdentifierType,
  PlanStatus,
} = dm;

const router = new Router();

// Get all
router.get('/', asyncMiddleware(async (req, res) => {
  try {
    const where = { active: true };
    const agreementType = await AgreementType.find(db, where);
    const agreementExemptionStatus = await AgreementExemptionStatus.find(db, where);
    const livestockType = await LivestockType.find(db, where);
    const planStatus = await PlanStatus.find(db, where);
    const clientType = await ClientType.find(db, where);
    const livestockIdentifierType = await LivestockIdentifierType.find(db, where);

    const response = {
      AGREEMENT_TYPE: agreementType || { error: 'Unable to fetch reference data' },
      AGREEMENT_EXEMPTION_STATUS: agreementExemptionStatus || { error: 'Unable to fetch reference data' },
      LIVESTOCK_TYPE: livestockType || { error: 'Unable to fetch reference data' },
      PLAN_STATUS: planStatus || { error: 'Unable to fetch reference data' },
      CLIENT_TYPE: clientType || { error: 'Unable to fetch reference data' },
      LIVESTOCK_IDENTIFIER_TYPE: livestockIdentifierType || { error: 'Unable to fetch reference data' },
    };

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ error: err.message }).end();
  }
}));

export default router;
