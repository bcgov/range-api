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
import { EmailTemplateController } from '../controllers_v1/EmailTemplateController';

const router = new Router();

// Get all emailTempaltes
router.get('/', asyncMiddleware(EmailTemplateController.allEmailTemplate));

// Update EmailTemplate info
router.put('/:templateId', asyncMiddleware(EmailTemplateController.updateMe));

export default router;
