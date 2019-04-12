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

import { asyncMiddleware } from '@bcgov/nodejs-common-utils';
import { Router } from 'express';

/**
 * Controller for individual routes related to plan.
 */
import PlanController from '../controllers_v1/PlanController';
import PlanStatusController from '../controllers_v1/PlanStatusController';
import PlanPastureController from '../controllers_v1/PlanPastureController';
import PlanScheduleController from '../controllers_v1/PlanScheduleController';
import PlanMinisterIssueController from '../controllers_v1/PlanMinisterIssueController';
import PlanMinisterIssueActionController from '../controllers_v1/PlanMinisterIssueActionController';
import PlanInvasivePlantController from '../controllers_v1/PlanInvasivePlantController';
import PlanManagementConsiderationController from '../controllers_v1/PlanManagementConsiderationController';

const router = new Router();

// Get a specific plan.
router.get('/:planId?', asyncMiddleware(PlanController.show));

// Create a new plan.
router.post('/', asyncMiddleware(PlanController.store));

// Update an existing plan
router.put('/:planId?', asyncMiddleware(PlanController.update));

// Update the status of an existing plan.
router.put('/:planId?/status', asyncMiddleware(PlanStatusController.update));

// update existing amendment confirmation
router.put('/:planId?/confirmation/:confirmationId?', asyncMiddleware(PlanStatusController.updateAmendment));

// create a plan status history
router.post('/:planId?/status-record', asyncMiddleware(PlanStatusController.storeStatusHistory));

//
// Pasture
//

// Add a Pasture to an existing Plan
router.post('/:planId?/pasture', asyncMiddleware(PlanPastureController.store));

// Update the existing Pasture of an existing Plan
router.put('/:planId?/pasture/:pastureId?', asyncMiddleware(PlanPastureController.update));

// create a plant community
router.post('/:planId?/pasture/:pastureId?/plant-community', asyncMiddleware(PlanPastureController.storePlatCommunity));

// create a plant community action
router.post('/:planId?/pasture/:pastureId?/plant-community/:communityId/action', asyncMiddleware(PlanPastureController.storePlantCommunityAction));

// create a indicator plant
router.post('/:planId?/pasture/:pastureId?/plant-community/:communityId/indicator-plant',
  asyncMiddleware(PlanPastureController.storeIndicatorPlant));

// create a monitoring area
router.post('/:planId?/pasture/:pastureId?/plant-community/:communityId/monitoring-area',
  asyncMiddleware(PlanPastureController.storeMonitoringArea));

//
// Schedule
//

// Add a Schedule (and related Grazing Schedule Entries) to an existing Plan
router.post('/:planId?/schedule', asyncMiddleware(PlanScheduleController.store));

// Update an existing Schedule (and related Grazing Schedule Entries) of an existing Plan
router.put('/:planId?/schedule/:scheduleId?', asyncMiddleware(PlanScheduleController.update));

// Remove a Schedule (and related Grazing Schedule Entries) from an existing Plan
router.delete('/:planId?/schedule/:scheduleId?', asyncMiddleware(PlanScheduleController.destroy));

// Add a grazing schedule entry to an existing grazing schedule
router.post('/:planId?/schedule/:scheduleId?/entry', asyncMiddleware(PlanScheduleController.storeScheduleEntry));

// Remove a Grazing Schedule Entries from Grazing Schedule
router.delete('/:planId?/schedule/:scheduleId?/entry/:grazingScheduleEntryId?',
  asyncMiddleware(PlanScheduleController.destroyScheduleEntry));

//
// Minister Issues
//

// Add a Minister Issue to an existing Plan
router.post('/:planId?/issue', asyncMiddleware(PlanMinisterIssueController.store));

// Update a Minister Issue to an existing Plan
router.put('/:planId?/issue/:issueId?', asyncMiddleware(PlanMinisterIssueController.update));

// Remove a Minister Issue from an existing Plan
router.delete('/:planId?/issue/:issueId?', asyncMiddleware(PlanMinisterIssueController.destroy));

//
// Minister Issue Action
//

// Add a Minister Issue Action to an existing Minister Issue
router.post('/:planId?/issue/:issueId?/action', asyncMiddleware(PlanMinisterIssueActionController.store));

// Update a Minister Issue Action to an existing Minister Issue
router.put('/:planId?/issue/:issueId?/action/:actionId', asyncMiddleware(PlanMinisterIssueActionController.update));

// Delete a Minister Issue Action
router.delete('/:planId?/issue/:issueId?/action/:actionId', asyncMiddleware(PlanMinisterIssueActionController.destroy));

/**
 * Invasive plant
 */
// Create an invasive plant checklist
router.post('/:planId?/invasive-plant-checklist', asyncMiddleware(PlanInvasivePlantController.store));

// Update an invasive plant checklist
router.put('/:planId?/invasive-plant-checklist/:checklistId?', asyncMiddleware(PlanInvasivePlantController.update));

// Create an additional requirement
router.post('/:planId?/additional-requirement', asyncMiddleware(PlanController.storeAdditionalRequirement));

// Create a management consideration
router.post('/:planId?/management-consideration', asyncMiddleware(PlanManagementConsiderationController.store));

// Update a management consideration
router.put('/:planId?/management-consideration/:considerationId?', asyncMiddleware(PlanManagementConsiderationController.update));

// Delete a management consideration
router.delete('/:planId?/management-consideration/:considerationId?', asyncMiddleware(PlanManagementConsiderationController.destroy));

module.exports = router;
