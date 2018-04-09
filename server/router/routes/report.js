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
  Client,
  // ClientType,
  ClientAgreement,
  Usage,
  Agreement,
  AgreementExemptionStatus,
  Zone,
  District,
  LivestockIdentifier,
  LivestockIdentifierLocation,
  LivestockIdentifierType,
  Pasture,
  Plan,
  PlanStatus,
  GrazingSchedule,
  GrazingScheduleEntry,
  LivestockType,
} = dm;

const INCLUDE_ZONE = {
  model: Zone,
  include: [{
    model: District,
    attributes: {
      exclude: ['createdAt', 'updatedAt'],
    },
  }],
  attributes: {
    exclude: ['districtId', 'createdAt', 'updatedAt'],
  },
};
const INCLUDE_CLIENT = {
  model: Client,
  through: {
    model: ClientAgreement,
    attributes: ['clientTypeId'],
  },
  attributes: ['id', 'name', 'locationCode', 'startDate'],
};
const INCLUDE_AGREEMENT_EXEMPTION_STATUS = {
  model: AgreementExemptionStatus,
  attributes: {
    exclude: ['active', 'createdAt', 'updatedAt'],
  },
};
const INCLUDE_LIVESTOCK_IDENTIFIER = {
  model: LivestockIdentifier,
  include: [LivestockIdentifierLocation, LivestockIdentifierType],
  attributes: {
    exclude: ['livestock_identifier_type_id', 'livestock_identifier_location_id'],
  },
};
const INCLUDE_PLAN = {
  model: Plan,
  attributes: {
    exclude: ['status_id'],
  },
  order: [
    ['create_at', 'DESC'],
  ],
  include: [
    {
      model: PlanStatus,
      as: 'status',
    }, {
      model: Pasture,
      attributes: {
        exclude: ['plan_id'],
      },
    },
    {
      model: GrazingSchedule,
      include: [{
        model: GrazingScheduleEntry,
        include: [LivestockType, Pasture],
        attributes: {
          exclude: ['grazing_schedule_id', 'livestock_type_id', 'plan_grazing_schedule'],
        },
      }],
    },
  ],
};
const INCLUDE_USAGE = {
  model: Usage,
  as: 'usage',
  attributes: {
    exclude: ['agreement_id', 'agreementId', 'createdAt', 'updatedAt'],
  },
};
const STANDARD_INCLUDE_NO_ZONE = [INCLUDE_CLIENT, INCLUDE_AGREEMENT_EXEMPTION_STATUS,
  INCLUDE_LIVESTOCK_IDENTIFIER, INCLUDE_PLAN, INCLUDE_USAGE];
const EXCLUDED_AGREEMENT_ATTR = ['agreementTypeId', 'zoneId', 'agreementExemptionStatusId'];

//
// PDF
//

const filterZonesOnUser = (user) => {
  if (!user.isAdministrator()) {
    return Object.assign(INCLUDE_ZONE, { where: { userId: user.id } });
  }

  return INCLUDE_ZONE;
};

router.get('/:agreementId/', asyncMiddleware(async (req, res) => {
  const {
    agreementId,
  } = req.params;

  try {
    const agreement = (await Agreement.findOne({
      where: {
        id: agreementId,
      },
      include: STANDARD_INCLUDE_NO_ZONE.concat(filterZonesOnUser(req.user)),
      attributes: {
        exclude: EXCLUDED_AGREEMENT_ATTR,
      },
    })).get({ plain: true });

    if (!agreement) {
      throw errorWithCode(`No Agreement with ID ${agreementId} exists`, 400);
    }

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
