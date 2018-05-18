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
import fs from 'fs';
import config from '../../config';
import { TEMPLATES } from '../../constants';
import DataManager from '../../libs/db2';
import { logger } from '../../libs/logger';
import { compile, loadTemplate, renderToPDF } from '../../libs/template';
import { asyncMiddleware, errorWithCode, streamToBuffer } from '../../libs/utils';

const router = new Router();
const dm2 = new DataManager(config);
const {
  db,
  Agreement,
  Plan,
} = dm2;

const userCanAccessAgreement = async (user, agreementId) => {
  const agreements = await Agreement.find(db, { forest_file_id: agreementId });
  if (agreements.length === 0) {
    throw errorWithCode('Unable to find the related agreement', 500);
  }

  const agreement = agreements.pop();

  if (!user.canAccessAgreement(agreement)) {
    return false;
  }

  return true;
};

//
// PDF
//

router.get('/:planId/', asyncMiddleware(async (req, res) => {
  const {
    planId: pId,
  } = req.params;
  const planId = Number(pId);

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    if (!userCanAccessAgreement(req.user, agreementId)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    const results = await Agreement.findWithAllRelations(db, { forest_file_id: agreementId });
    const agreement = results.pop();
    agreement.transformToV1();

    const plan = agreement.plans.find(p => p.id === planId);
    await plan.fetchPastures();
    await plan.fetchGrazingSchedules();

    const { pastures, grazingSchedules } = plan || [];
    const { zone } = agreement || {};
    const { user } = zone || {};
    const {
      givenName,
      familyName,
    } = user || {};
    user.name = givenName && familyName && `${givenName} ${familyName}`;

    const template = await loadTemplate(TEMPLATES.RANGE_USE_PLAN);
    const html = await compile(template, {
      agreement,
      plan,
      zone,
      pastures,
      grazingSchedules,
      user,
    });
    const stream = await renderToPDF(html);
    const buffer = await streamToBuffer(stream);

    // cleanup
    fs.unlink(stream.path, (err) => {
      if (err) {
        logger.warn(`Unable to remove file ${stream.path}`);
      }
    });

    if (!buffer) {
      return res.status(500).json({
        message: 'Unable to fetch report data.',
      });
    }

    res.contentType('application/pdf');

    return res.end(buffer, 'binary');
  } catch (err) {
    throw err;
  }
}));

module.exports = router;
