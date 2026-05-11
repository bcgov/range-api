// @ts-nocheck
'use strict';

import { Router } from 'express';
import { RoleController } from '../controllers_v1/RoleController.js';

const router = new Router();

// Get all roles
router.get('/', RoleController.allRoles);
export default router;
