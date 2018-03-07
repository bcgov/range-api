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
  Agreement,
  District,
  Extension,
  // LivestockIdentifier,
  // MonitoringCriteria,
  // MonitoringSite,
  // Pasture,
  // PastureSchedule,
  // PastureScheduleEntry,
  // PlantCommunity,
  // PlantCommunityAction,
  // RangeReadinessCriteria,
  // Readiness,
  // Reference,
  // ShrubUseCriteria,
  // SpeciesReference,
  // StubbleHeightCriteria,
  // Usage,
  Zone,
} = dm;

const router = new Router();

// Includes all nested json data for Agreement
const includeAllChildren = [
  {
    model: Zone,
    include: [District],
    attributes: {
      exclude: ['districtId'],
    },
  },
  Extension,
];

// All children ids in agreement object
const childIds = ['zoneId', 'extensionId'];

// Create agreement
router.post('/', asyncMiddleware(async (req, res) => {
  res.send('Not implemented').end();
}));

// Get all
router.get('/', asyncMiddleware(async (req, res) => {
  try {
    const agreements = await Agreement.findAll({
      include: includeAllChildren,
      attributes: {
        exclude: childIds,
      },
    });
    res.status(200).json(agreements).end();
  } catch (err) {
    res.status(500).json({ error: err }).end();
  }
}));

// Update agreement
router.put('/', asyncMiddleware(async (req, res) => {
  res.send('Not implemented').end();
}));

// Get by id
router.get('/:id', asyncMiddleware(async (req, res) => {
  try {
    const {
      id,
    } = req.params;

    const agreement = await Agreement.findOne({
      where: {
        id,
      },
      include: includeAllChildren,
      attributes: {
        exclude: childIds,
      },
    });

    if (agreement != null) {
      res.status(200).json(agreement).end();
    } else {
      res.status(404).json({ error: 'Not found' }).end();
    }
  } catch (err) {
    res.status(500).json({ error: err }).end();
  }
}));

// Delete agreement
router.delete('/:id', asyncMiddleware(async (req, res) => {
  res.send('Not implemented').end();
}));

module.exports = router;
