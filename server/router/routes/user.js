
//
// MYRA
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
// Created by Kyubin Han on 2018-04-12.
//

/* eslint-env es6 */

'use strict';

import { asyncMiddleware, errorWithCode } from '@bcgov/nodejs-common-utils';
import { Router } from 'express';
import config from '../../config';
import DataManager from '../../libs/db2';
import { checkRequiredFields } from '../../libs/utils';

const router = new Router();
const dm = new DataManager(config);
const {
  db,
  User,
  Client,
} = dm;

// Get all users
router.get('/', asyncMiddleware(async (req, res) => {
  try {
    const { user } = req;

    if (user && user.isAgreementHolder()) {
      throw errorWithCode('You do not have the permission as an agreement holder', 403);
    }

    const users = await User.find(db, {});

    res.status(200).json(users).end();
  } catch (error) {
    throw error;
  }
}));

// Get user information
router.get('/me', asyncMiddleware(async (req, res) => {
  try {
    const { user } = req;
    delete user.created_at;
    delete user.updated_at;

    res.status(200).json(user).end();
  } catch (error) {
    throw error;
  }
}));

router.put('/me', asyncMiddleware(async (req, res) => {
  try {
    const { body, user } = req;
    const { id: userId } = user;
    const {
      givenName,
      familyName,
      phoneNumber,
    } = body;

    const updated = await User.update(db, { id: userId }, {
      givenName,
      familyName,
      phoneNumber,
    });

    res.status(200).json(updated).end();
  } catch (error) {
    throw error;
  }
}));

// Assign a client id to user
router.put('/:userId?/client/:clientId?', asyncMiddleware(async (req, res) => {
  try {
    const { user, params } = req;
    const { clientId, userId } = params;

    checkRequiredFields(
      ['clientId', 'userId'], 'params', req,
    );

    if (user && user.isAgreementHolder()) {
      throw errorWithCode('You do not have the permission as an agreement holder', 403);
    }

    const client = await Client.find(db, { client_number: clientId });
    if (!client) {
      throw errorWithCode('Client does not exist', 400);
    }

    const result = await User.update(db, { id: userId }, {
      client_id: clientId,
      active: true,
    });

    res.status(200).json(result).end();
  } catch (error) {
    throw error;
  }
}));

module.exports = router;
