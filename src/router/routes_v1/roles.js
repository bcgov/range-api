/* eslint-env es6 */

'use strict';

import { asyncMiddleware } from '@bcgov/nodejs-common-utils';
import { Router } from 'express';
import { RoleController } from '../controllers_v1/RoleController';

const router = new Router();

// Get all roles
router.get('/', asyncMiddleware(RoleController.allRoles));
module.exports = router;