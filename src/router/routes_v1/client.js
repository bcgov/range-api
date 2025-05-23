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

'use strict';

import { asyncMiddleware, errorWithCode } from '@bcgov/nodejs-common-utils';
import { Router } from 'express';
import config from '../../config';
import DataManager from '../../libs/db2';
import Plan from '../../libs/db2/model/plan';
import { PlanRouteHelper } from '../helpers';

const dm = new DataManager(config);
const { db, Client, ClientAgreement, Agreement, User } = dm;

const router = new Router();

// Get all clients
router.get(
  '/',
  asyncMiddleware(async (req, res) => {
    if (req.user && req.user.isAgreementHolder()) {
      throw errorWithCode('Unauthorized', 401);
    }

    const results = await Client.find(db, {});
    res.status(200).json(results).end();
  }),
);

// Search clients
router.get(
  '/search',
  asyncMiddleware(async (req, res) => {
    const { term = '' } = req.query;
    const results = await Client.searchByNameWithAllFields(db, term);
    res.status(200).json(results).end();
  }),
);

// Get by client number
router.get(
  '/:clientNumber',
  asyncMiddleware(async (req, res) => {
    const { clientNumber } = req.params;

    if (req.user && req.user.isAgreementHolder()) {
      throw errorWithCode('Unauthorized', 401);
    }

    const results = await Client.find(db, { client_number: clientNumber });
    if (results.length === 0) {
      res.status(404).json({ error: 'Not found' }).end();
    }

    res.status(200).json(results.pop()).end();
  }),
);

router.get(
  '/agreements/:planId',
  asyncMiddleware(async (req, res) => {
    const { planId } = req.params;

    if (!req.user) {
      throw errorWithCode('Unauthorized', 401);
    }
    if (!Number(planId)) {
      throw errorWithCode('Invalid planId', 400);
    }
    const { agreementId } = await Plan.findOne(db, { id: planId });

    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, req.user, agreementId);

    const clientAgreements = await ClientAgreement.find(db, {
      agreement_id: agreementId,
    });

    const clientAgreementObjects = await Promise.all(
      clientAgreements.map(async (ca) => {
        const clientAgreement = ca;

        const client = await Client.findOne(db, {
          client_number: clientAgreement.clientId,
        });
        clientAgreement.client = client;

        if (clientAgreement.agentId) {
          const agent = await User.findOne(db, { id: clientAgreement.agentId });
          clientAgreement.agent = agent;
        }

        return clientAgreement;
      }),
    );

    res.json(clientAgreementObjects).end();
  }),
);

router.put(
  '/agreements/:planId/:clientAgreementId',
  asyncMiddleware(async (req, res) => {
    const { planId, clientAgreementId } = req.params;
    const { user, body } = req;

    if (!user || user.isAgreementHolder()) {
      throw errorWithCode('Unauthorized', 401);
    }

    const { agreementId } = await Plan.findOne(db, { id: planId });

    await PlanRouteHelper.canUserAccessThisAgreement(db, Agreement, req.user, agreementId);

    const clientAgreement = await ClientAgreement.update(db, { id: clientAgreementId }, body);

    res.json(clientAgreement).end();
  }),
);

// Get all client records with a given client number
router.get(
  '/all/:clientNumber',
  asyncMiddleware(async (req, res) => {
    const { clientNumber } = req.params;

    if (req.user && req.user.isAgreementHolder()) {
      throw errorWithCode('Unauthorized', 401);
    }

    const clients = await Client.find(db, { client_number: clientNumber });

    res.status(200).json({ clients }).end();
  }),
);

export default router;
