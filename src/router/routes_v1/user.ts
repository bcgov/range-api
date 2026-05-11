// @ts-nocheck
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

'use strict';

import { Router } from 'express';
import { UserController } from '../controllers_v1/UserController.js';

const router = new Router();

// Get all users
router.get('/', UserController.allUser);

// Get user information
router.get('/me', UserController.me);

// Get User info
router.put('/me', UserController.updateMe);

router.get('/:userId', UserController.show);

// Assign a client id to user
router.post('{/:userId}/client', UserController.addClientLink);
router.delete('{/:userId}/client{/:clientNumber}', UserController.removeClientLink);

router.post('{/:userId}/merge', UserController.mergeAccounts);

// Assign role to user
router.post('{/:userId}/assignRole', UserController.assignUserRole);

// Assign district to user
router.post('{/:userId}/assignDistrict', UserController.assignUserDistrict);

// Assign multiple district to user
router.post('{/:userId}/assignDistricts', UserController.assignUserDistricts);

// Get districts for pasture import
router.get('{/:userId}/districts', UserController.getAssociatedDistricts);
export default router;
