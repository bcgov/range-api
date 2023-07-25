
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

import { asyncMiddleware } from '@bcgov/nodejs-common-utils';
import { Router } from 'express';
import { UserController } from '../controllers_v1/UserController';

const router = new Router();

// Get all users
router.get('/', asyncMiddleware(UserController.allUser));

// Get user information
router.get('/me', asyncMiddleware(UserController.me));

// Get User info
router.put('/me', asyncMiddleware(UserController.updateMe));

router.get('/:userId', asyncMiddleware(UserController.show));

// Assign a client id to user
router.post('/:userId?/client', asyncMiddleware(UserController.addClientLink));
router.delete('/:userId?/client/:clientNumber?', asyncMiddleware(UserController.removeClientLink));

router.post('/:userId?/merge', asyncMiddleware(UserController.mergeAccounts));
module.exports = router;
