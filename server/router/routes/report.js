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
import moment from 'moment';
import config from '../../config';
import { TEMPLATES } from '../../constants';
import DataManager from '../../libs/db2';
import { compile, loadTemplate, renderToPDF } from '../../libs/template';

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

const shift = (number, precision) => {
  const numArray = (`${number}`).split('e');
  return +(`${numArray[0]}e${(numArray[1] ? (+numArray[1] + precision) : precision)}`);
};

const round = (number, precision) => (
  shift(Math.round(shift(number, +precision)), -precision)
);

/**
 * Round the float to 1 decimal
 *
 * @param {float} number
 * @returns the rounded float number
 */
const roundTo1Decimal = number => (
  round(number, 1)
);

/**
 *
 * @param {number} numberOfAnimals
 * @param {number} totalDays
 * @param {number} auFactor parameter provided from the livestock type
 * @returns {float} the total AUMs
 */
const calcTotalAUMs = (numberOfAnimals = 0, totalDays, auFactor = 0) => (
  ((numberOfAnimals * totalDays * auFactor) / 30.44)
);

/**
 * Present user friendly string when getting null or undefined value
 *
 * @param {string | Date} first the string in the class Date form
 * @param {string | Date} second the string in the class Date form
 * @param {bool} isUserFriendly
 * @returns {number | string} the number of days or 'N/P'
 */
const calcDateDiff = (first, second, isUserFriendly) => {
  if (first && second) {
    return moment(first).diff(moment(second), 'days');
  }
  return isUserFriendly ? 'N/P' : 0;
};

/**
 * Calculate Private Land Deduction Animal Unit Month
 *
 * @param {number} totalAUMs
 * @param {float} pasturePldPercent
 * @returns {float} the pld AUMs
 */
const calcPldAUMs = (totalAUMs, pasturePldPercent = 0) => (
  totalAUMs * pasturePldPercent
);

/**
 * Calculate Crown Animal Unit Month
 *
 * @param {number} totalAUMs
 * @param {number} pldAUMs
 * @returns {float} the crown AUMs
 */
const calcCrownAUMs = (totalAUMs, pldAUMs) => (
  (totalAUMs - pldAUMs)
);

/**
 * Calculate the total Crown Animal Unit Month
 *
 * @param {Array} entries grazing schedule entries
 * @returns {float} the total crown AUMs
 */
const calcCrownTotalAUMs = (entries = []) => {
  const reducer = (accumulator, currentValue) => accumulator + currentValue;
  if (entries.length === 0) {
    return 0;
  }
  return entries
    .map(entry => entry.crownAUMs)
    .reduce(reducer);
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

    const { pastures, grazingSchedules } = plan || [];
    const { zone } = agreement || {};
    const { user } = zone || {};
    const {
      givenName,
      familyName,
    } = user || {};

    const calculatedGrazingSchedules = grazingSchedules.map((schedule) => {
      const { grazingScheduleEntries: gse } = schedule;
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
      const crownTotalAUMs = calcCrownTotalAUMs(grazingScheduleEntries);
      return {
        ...schedule,
        grazingScheduleEntries,
        crownTotalAUMs,
      };
    });

    user.name = givenName && familyName && `${givenName} ${familyName}`;

    const template = await loadTemplate(TEMPLATES.RANGE_USE_PLAN);
    const html = await compile(template, {
      agreement,
      plan,
      zone,
      pastures,
      calculatedGrazingSchedules,
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
