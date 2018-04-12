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

import fs from 'fs';
import { Router } from 'express';
import {
  asyncMiddleware,
  errorWithCode,
  streamToBuffer,
} from '../../libs/utils';
import {
  loadTemplate,
  renderToPDF,
  compile,
} from '../../libs/template';
import { logger } from '../../libs/logger';
import { TEMPLATES } from '../../constants';
import config from '../../config';
import DataManager from '../../libs/db';

const router = new Router();
const dm = new DataManager(config);
const {
  Agreement,
  INCLUDE_CLIENT_MODEL,
  INCLUDE_AGREEMENT_EXEMPTION_STATUS_MODEL,
  INCLUDE_LIVESTOCK_IDENTIFIER_MODEL,
  INCLUDE_PLAN_MODEL,
  INCLUDE_USAGE_MODEL,
  INCLUDE_AGREEMENT_TYPE_MODEL,
  EXCLUDED_AGREEMENT_ATTR,
} = dm;

//
// PDF
//

router.get('/:planId/', asyncMiddleware(async (req, res) => {
  const {
    planId,
  } = req.params;

  try {
    const myPlan = { ...INCLUDE_PLAN_MODEL, where: { id: planId } };
    const myIncludes = [INCLUDE_CLIENT_MODEL, INCLUDE_AGREEMENT_EXEMPTION_STATUS_MODEL,
      INCLUDE_LIVESTOCK_IDENTIFIER_MODEL, INCLUDE_USAGE_MODEL, INCLUDE_AGREEMENT_TYPE_MODEL,
      myPlan, dm.zoneIncludeForUserRole(req.user)];
    const agreement = (await Agreement.findOne({
      include: myIncludes,
      attributes: {
        exclude: EXCLUDED_AGREEMENT_ATTR,
      },
    })).get({ plain: true });

    if (!agreement) {
      throw errorWithCode(`No Plan with ID ${planId} exists`, 400);
    }

    // console.log(agreement);

    const template = await loadTemplate(TEMPLATES.RANGE_USE_PLAN);
    const html = await compile(template, { agreement });
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

    res.contentType('application/octet-stream');

    return res.end(buffer, 'binary');
  } catch (err) {
    throw err;
  }
}));

module.exports = router;
