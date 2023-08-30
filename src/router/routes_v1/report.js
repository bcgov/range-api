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

import { asyncMiddleware, errorWithCode } from '@bcgov/nodejs-common-utils';
import { Router } from 'express';
import wkhtmltopdf from 'wkhtmltopdf';
import config from '../../config';
import { TEMPLATES } from '../../constants';
import DataManager from '../../libs/db2';
import { compile, loadTemplate, calcDateDiff, calcTotalAUMs, calcPldAUMs, calcCrownAUMs, roundToSingleDecimalPlace, calcCrownTotalAUMs, getPastureNames } from '../../libs/template';

const router = new Router();
const dm2 = new DataManager(config);
const {
  db,
  Agreement,
  Plan,
} = dm2;

const userCanAccessAgreement = async (user, agreementId) => {
  const [agreement] = await Agreement.find(db, { forest_file_id: agreementId });
  if (!agreement) {
    throw errorWithCode('Unable to find the related agreement', 500);
  }

  const can = await user.canAccessAgreement(db, agreement);
  if (!can) {
    throw errorWithCode('You do not access to this agreement', 403);
  }
};

//
// PDF
//

router.get('/:planId/', asyncMiddleware(async (req, res) => {
  const { user, params } = req;
  const { planId } = params;

  try {
    const agreementId = await Plan.agreementForPlanId(db, planId);
    if (!userCanAccessAgreement(user, agreementId)) {
      throw errorWithCode('You do not access to this agreement', 403);
    }

    const [agreement] = await Agreement.findWithAllRelations(db, { forest_file_id: agreementId });
    agreement.transformToV1();

    const [plan] = await Plan.findWithStatusExtension(db, { 'plan.id': planId }, ['id', 'desc']);
    await plan.eagerloadAllOneToMany();

    const { pastures, grazingSchedules: gss, ministerIssues: mis } = plan || [];
    const { zone } = agreement || {};
    const { user: staff } = zone || {};
    const { givenName, familyName } = staff;
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
        const pldAUMs = roundToSingleDecimalPlace(calcPldAUMs(totalAUMs, pldPercent));
        const crownAUMs = roundToSingleDecimalPlace(calcCrownAUMs(totalAUMs, pldAUMs));
        return {
          ...entry,
          pasture,
          graceDays,
          days,
          pldAUMs,
          crownAUMs,
        };
      });
      const crownTotalAUMs = roundToSingleDecimalPlace(calcCrownTotalAUMs(grazingScheduleEntries));
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
      ministerIssue.actionsExist = ministerIssue.ministerIssueActions
        && (ministerIssue.ministerIssueActions.length > 0);

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

    return wkhtmltopdf(html).pipe(res);
  } catch (err) {
    throw err;
  }
}));

module.exports = router;