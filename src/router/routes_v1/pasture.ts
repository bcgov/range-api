// @ts-nocheck
import { Router } from 'express';
import PlanPastureController from '../controllers_v1/PlanPastureController.js';

const router = new Router();

// List of Pastures for a given district
router.get('/', PlanPastureController.getPasturesForDistrict);

export default router;
