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

import { asyncMiddleware, errorWithCode, logger, streamToBuffer } from '@bcgov/nodejs-common-utils';
import { Router } from 'express';
import fs from 'fs';
import config from '../../config';
import { TEMPLATES } from '../../constants';
import DataManager from '../../libs/db2';
import { compile, loadTemplate, renderToPDF, calcDateDiff, calcTotalAUMs, calcPldAUMs, calcCrownAUMs, roundTo1Decimal, calcCrownTotalAUMs, getPastureNames } from '../../libs/template';

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
    await plan.eagerloadAllOneToMany();

    const { pastures, grazingSchedules: gss, ministerIssues: mis } = plan || [];
    const { zone } = agreement || {};
    const { user } = zone || {};
    const {
      givenName,
      familyName,
    } = user || {};
    user.name = givenName && familyName && `${givenName} ${familyName}`;

    const grazingSchedules = gss.map((schedule) => {
      const { grazingScheduleEntries: gse, year } = schedule;
      const grazingScheduleEntries = gse && gse.map((entry) => {
        const {
          pastureId,
          livestockType,
          livestockCount,
          dateIn,
          dateOut,
        } = entry;
        const days = calcDateDiff(dateOut, dateIn, false);
        const pasture = pastures.find(p => p.id === pastureId);
        const graceDays = pasture && pasture.graceDays;
        const pldPercent = pasture && pasture.pldPercent;
        const auFactor = livestockType && livestockType.auFactor;

        const totalAUMs = calcTotalAUMs(livestockCount, days, auFactor);
        const pldAUMs = roundTo1Decimal(calcPldAUMs(totalAUMs, pldPercent));
        const crownAUMs = roundTo1Decimal(calcCrownAUMs(totalAUMs, pldAUMs));
        return {
          ...entry,
          pasture,
          graceDays,
          pldAUMs,
          crownAUMs,
        };
      });
      const crownTotalAUMs = roundTo1Decimal(calcCrownTotalAUMs(grazingScheduleEntries));
      const yearUsage = agreement.usage.find(u => u.year === year);
      const authorizedAUMs = yearUsage && yearUsage.authorizedAum;
      return {
        ...schedule,
        grazingScheduleEntries,
        crownTotalAUMs,
        authorizedAUMs,
      };
    });

    const ministerIssues = mis.map((mi) => {
      const ministerIssue = { ...mi };
      ministerIssue.pastureNames = getPastureNames(ministerIssue.pastures, pastures);

      return ministerIssue;
    });

    const template = await loadTemplate(TEMPLATES.RANGE_USE_PLAN);
    const html = await compile(template, {
      user,
      agreement,
      plan,
      zone,
      pastures,
      grazingSchedules,
      ministerIssues,
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
