import { Router } from 'express';
import PlanPastureController from '../controllers_v1/PlanPastureController';
import { asyncMiddleware } from '@bcgov/nodejs-common-utils';

const router = new Router();

// List of Pastures for a given district
router.get('/', asyncMiddleware(PlanPastureController.getPasturesForDistrict));

export default router;
