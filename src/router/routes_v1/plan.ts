// @ts-nocheck
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

import { Router } from 'express';

import PlanController from '../controllers_v1/PlanController.js';
/**
 * Controller for individual routes related to plan.
 */
import PlanExtensionController from '../controllers_v1/PlanExtensionController.js';
import PlanInvasivePlantController from '../controllers_v1/PlanInvasivePlantController.js';
import PlanManagementConsiderationController from '../controllers_v1/PlanManagementConsiderationController.js';
import PlanMinisterIssueActionController from '../controllers_v1/PlanMinisterIssueActionController.js';
import PlanMinisterIssueController from '../controllers_v1/PlanMinisterIssueController.js';
import PlanPastureController from '../controllers_v1/PlanPastureController.js';
import PlanScheduleController from '../controllers_v1/PlanScheduleController.js';
import PlanStatusController from '../controllers_v1/PlanStatusController.js';
import PlanVersionController from '../controllers_v1/PlanVersionController.js';

const router = new Router();

// Get a specific plan.
router.get('{/:planId}', PlanController.show);

// Create a new plan.
router.post('/', PlanController.store);

// Update an existing plan
router.put('{/:planId}', PlanController.update);

// Update the status of an existing plan.
router.put('{/:planId}/status', PlanStatusController.update);

// update existing amendment confirmation
router.put('{/:planId}/confirmation{/:confirmationId}', PlanStatusController.updateAmendment);

// create a plan status history
router.post('{/:planId}/status-record', PlanStatusController.storeStatusHistory);

// discard amendment
router.post('{/:planId}/discard-amendment', PlanController.discardAmendment);

// add attachment
router.post('{/:planId}/attachment', PlanController.storeAttachment);

// update attachment
router.put('{/:planId}/attachment{/:attachmentId}', PlanController.updateAttachment);

// remove attachment
router.delete('{/:planId}/attachment{/:attachmentId}', PlanController.removeAttachment);

//
// Versions
//

// Create a new version
router.post('{/:planId}/version', PlanVersionController.store);

// Get all versions for a plan
router.get('{/:planId}/version', PlanVersionController.showAll);

// Get a specific version for a plan
router.get('{/:planId}/version{/:version}', PlanVersionController.show);

// Restore a previous version of a plan
router.post('{/:planId}/version{/:version}/restore', PlanVersionController.restoreVersion);

// Download Plan PDF
router.get('/:planId/version/:version/download', PlanVersionController.download);
//
// Pasture
//

// Add a Pasture to an existing Plan
router.post('{/:planId}/pasture', PlanPastureController.store);

// Update the existing Pasture of an existing Plan
router.put('{/:planId}/pasture{/:pastureId}', PlanPastureController.update);

router.delete('{/:planId}/pasture{/:pastureId}', PlanPastureController.destroy);

// create a plant community
router.post('{/:planId}/pasture{/:pastureId}/plant-community', PlanPastureController.storePlatCommunity);

// Update an existing plant community
router.put('{/:planId}/pasture{/:pastureId}/plant-community/:communityId', PlanPastureController.updatePlantCommunity);

// Delete an existing plant community
router.delete(
  '{/:planId}/pasture{/:pastureId}/plant-community/:communityId',
  PlanPastureController.destroyPlantCommunity,
);

// create a plant community action
router.post(
  '{/:planId}/pasture{/:pastureId}/plant-community/:communityId/action',
  PlanPastureController.storePlantCommunityAction,
);

// Update a plant community action
router.put(
  '{/:planId}/pasture{/:pastureId}/plant-community/:communityId/action/:actionId',
  PlanPastureController.updatePlantCommunityAction,
);

// Delete a plant community action
router.delete(
  '{/:planId}/pasture{/:pastureId}/plant-community/:communityId/action/:actionId',
  PlanPastureController.destroyPlantCommunityAction,
);

// create a indicator plant
router.post(
  '{/:planId}/pasture{/:pastureId}/plant-community/:communityId/indicator-plant',
  PlanPastureController.storeIndicatorPlant,
);

// Update an indicator plant
router.put(
  '{/:planId}/pasture{/:pastureId}/plant-community/:communityId/indicator-plant{/:plantId}',
  PlanPastureController.updateIndicatorPlant,
);

// Delete an indicator plant
router.delete(
  '{/:planId}/pasture{/:pastureId}/plant-community/:communityId/indicator-plant{/:plantId}',
  PlanPastureController.destroyIndicatorPlant,
);

// create a monitoring area
router.post(
  '{/:planId}/pasture{/:pastureId}/plant-community/:communityId/monitoring-area',
  PlanPastureController.storeMonitoringArea,
);

// Update a monitoring area
router.put(
  '{/:planId}/pasture{/:pastureId}/plant-community/:communityId/monitoring-area{/:areaId}',
  PlanPastureController.updateMonitoringArea,
);

// Delete a monitoring area
router.delete(
  '{/:planId}/pasture{/:pastureId}/plant-community/:communityId/monitoring-area{/:areaId}',
  PlanPastureController.destroyMonitoringArea,
);

//
// Schedule
//

// Add a Schedule (and related Grazing Schedule Entries) to an existing Plan
router.post('{/:planId}/schedule', PlanScheduleController.store);

// Update an existing Schedule (and related Grazing Schedule Entries) of an existing Plan
router.put('{/:planId}/schedule{/:scheduleId}', PlanScheduleController.update);

// Update an existing Schedule sort order
router.put('{/:planId}/schedule{/:scheduleId}/sortOrder', PlanScheduleController.updateSortOrder);

// Remove a Schedule (and related Grazing Schedule Entries) from an existing Plan
router.delete('{/:planId}/schedule{/:scheduleId}', PlanScheduleController.destroy);

// Remove a Grazing Schedule Entries from Grazing Schedule
router.delete(
  '{/:planId}/schedule{/:scheduleId}/entry{/:grazingScheduleEntryId}',
  PlanScheduleController.destroyScheduleEntry,
);

//
// Minister Issues
//

// Add a Minister Issue to an existing Plan
router.post('{/:planId}/issue', PlanMinisterIssueController.store);

// Update a Minister Issue to an existing Plan
router.put('{/:planId}/issue{/:issueId}', PlanMinisterIssueController.update);

// Remove a Minister Issue from an existing Plan
router.delete('{/:planId}/issue{/:issueId}', PlanMinisterIssueController.destroy);

//
// Minister Issue Action
//

// Add a Minister Issue Action to an existing Minister Issue
router.post('{/:planId}/issue{/:issueId}/action', PlanMinisterIssueActionController.store);

// Update a Minister Issue Action to an existing Minister Issue
router.put('{/:planId}/issue{/:issueId}/action/:actionId', PlanMinisterIssueActionController.update);

// Delete a Minister Issue Action
router.delete('{/:planId}/issue{/:issueId}/action/:actionId', PlanMinisterIssueActionController.destroy);

/**
 * Invasive plant
 */
// Create an invasive plant checklist
router.post('{/:planId}/invasive-plant-checklist', PlanInvasivePlantController.store);

// Update an invasive plant checklist
router.put('{/:planId}/invasive-plant-checklist{/:checklistId}', PlanInvasivePlantController.update);

// Create an additional requirement
router.post('{/:planId}/additional-requirement', PlanController.storeAdditionalRequirement);

// Update an additional requirement
router.put('{/:planId}/additional-requirement{/:requirementId}', PlanController.updateAdditionalRequirement);

// Delete an additional requirement
router.delete('{/:planId}/additional-requirement{/:requirementId}', PlanController.destroyAdditionalRequirement);

// Create a management consideration
router.post('{/:planId}/management-consideration', PlanManagementConsiderationController.store);

// Update a management consideration
router.put('{/:planId}/management-consideration{/:considerationId}', PlanManagementConsiderationController.update);

// Delete a management consideration
router.delete('{/:planId}/management-consideration{/:considerationId}', PlanManagementConsiderationController.destroy);

// Create a management consideration
router.get('{/:planId}/PDF', PlanController.downloadPDF);

// plan extension approve vote
router.put('{/:planId}/extension/approve', PlanExtensionController.approveExtension);

// Plan extension reject vote
router.put('{/:planId}/extension/reject', PlanExtensionController.rejectExtension);

// extend plan
router.put('{/:planId}/extension/extend', PlanExtensionController.extendPlan);
// return extension plan
router.get('{/:planId}/extension', PlanExtensionController.fetchReplacementPlan);
// create extension plan
router.put('{/:planId}/extension/createReplacementPlan', PlanExtensionController.createReplacementPlan);
// request extend plan
router.put('{/:planId}/extension/request', PlanExtensionController.requestExtension);
// request copy plan
router.put('{/:planId}/copy', PlanExtensionController.copyPlan);

export default router;
