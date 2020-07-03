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
import config from '../../config';
import DataManager from '../../libs/db2';

const dm = new DataManager(config);
const {
  db,
  AgreementType,
  AgreementExemptionStatus,
  ClientType,
  LivestockType,
  LivestockIdentifierType,
  PlanStatus,
  MinisterIssueActionType,
  MinisterIssueType,
  AmendmentType,
  PlantSpecies,
  PlantCommunityType,
  PlantCommunityElevation,
  PlantCommunityActionType,
  MonitoringAreaHealth,
  MonitoringAreaPurposeType,
  ManagementConsiderationType,
  AdditionalRequirementCategory,
  Zone,
  User
} = dm;

const router = new Router();

// Get all
router.get('/', asyncMiddleware(async (req, res) => {
  try {
    const where = { active: true };
    const agreementType = await AgreementType.find(db, where);
    const agreementExemptionStatus = await AgreementExemptionStatus.find(db, where);
    const livestockType = await LivestockType.find(db, where);
    const planStatus = await PlanStatus.find(db, where);
    const clientType = await ClientType.find(db, where);
    const livestockIdentifierType = await LivestockIdentifierType.find(db, where);
    const ministerIssueActionType = await MinisterIssueActionType.find(db, where);
    const ministerIssueType = await MinisterIssueType.find(db, where);
    const amendmentType = await AmendmentType.find(db, where);
    const plantSpecies = await PlantSpecies.find(db, where);
    const plantCommunityType = await PlantCommunityType.find(db, where);
    const plantCommunityElevation = await PlantCommunityElevation.find(db, where);
    const plantCommunityActionType = await PlantCommunityActionType.find(db, where);
    const monitoringAreaHealth = await MonitoringAreaHealth.find(db, where);
    const monitoringAreaPurposeType = await MonitoringAreaPurposeType.find(db, where);
    const managementConsiderationType = await ManagementConsiderationType.find(db, where);
    const additionalRequirementCategory = await AdditionalRequirementCategory.find(db, where);
    const zones = await Zone.find(db, {});
    const users = await User.find(db, { id: zones.map(zone => zone.userId) })

    const errorMessage = 'Unable to fetch reference data';

    const response = {
      AGREEMENT_TYPE: agreementType || { error: errorMessage },
      AGREEMENT_EXEMPTION_STATUS: agreementExemptionStatus || { error: errorMessage },
      LIVESTOCK_TYPE: livestockType || { error: errorMessage },
      PLAN_STATUS: planStatus || { error: errorMessage },
      CLIENT_TYPE: clientType || { error: errorMessage },
      LIVESTOCK_IDENTIFIER_TYPE: livestockIdentifierType || { error: errorMessage },
      MINISTER_ISSUE_ACTION_TYPE: ministerIssueActionType || { error: errorMessage },
      MINISTER_ISSUE_TYPE: ministerIssueType || { error: errorMessage },
      AMENDMENT_TYPE: amendmentType || { error: errorMessage },
      PLANT_SPECIES: plantSpecies || { error: errorMessage },
      PLANT_COMMUNITY_TYPE: plantCommunityType || { error: errorMessage },
      PLANT_COMMUNITY_ELEVATION: plantCommunityElevation || { error: errorMessage },
      PLANT_COMMUNITY_ACTION_TYPE: plantCommunityActionType || { error: errorMessage },
      MONITORING_AREA_HEALTH: monitoringAreaHealth || { error: errorMessage },
      MONITORING_AREA_PURPOSE_TYPE: monitoringAreaPurposeType || { error: errorMessage },
      MANAGEMENT_CONSIDERATION_TYPE: managementConsiderationType || { error: errorMessage },
      ADDITIONAL_REQUIREMENT_CATEGORY: additionalRequirementCategory || { error: errorMessage },
      ZONES: zones || {error: errorMessage},
      USERS: users || {error: errorMessage}
    };

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ error: err.message }).end();
  }
}));

export default router;
