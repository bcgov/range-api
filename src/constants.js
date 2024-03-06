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
// Created by Jason Leach on 2018-01-10.
//

/* eslint-env es6 */

'use strict';

// eslint-disable-next-line import/prefer-default-export
export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
};

export const API_URL = {
  PROD: 'https://web-range-myra-prod.pathfinder.gov.bc.ca/api',
  DEV: 'https://web-range-myra-dev.pathfinder.gov.bc.ca/api',
  TEST: 'https://web-range-myra-test.pathfinder.gov.bc.ca/api',
};

export const TEMPLATES = {
  RANGE_USE_PLAN: 'rup.html',
};

export const DAYS_ON_THE_AVERAGE = 30.44;

export const DATE_FORMAT = {
  SERVER_SIDE: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  CLIENT_SIDE: 'MMMM D, YYYY',
  CLIENT_SIDE_WITHOUT_YEAR: 'MMM D',
};

export const AGREEMENT_HOLDER_ROLE = {
  PRIMARY: 'A',
  SECONDARY: 'B',
};

export const SSO_ROLE_MAP = {
  ADMINISTRATOR: 'myra_admin',
  RANGE_OFFICER: 'myra_range_officer',
  AGREEMENT_HOLDER: 'myra_client',
  DECISION_MAKER: 'myra_decision_maker',
};

export const PLAN_STATUS = {
  PENDING: 'P',
  COMPLETED: 'O',
  DRAFT: 'D',
  CREATED: 'C',
  CHANGE_REQUESTED: 'R',
  STAFF_DRAFT: 'SD',
  WRONGLY_MADE_WITHOUT_EFFECT: 'WM',
  STANDS_WRONGLY_MADE: 'SW',
  STANDS: 'S',
  NOT_APPROVED_FURTHER_WORK_REQUIRED: 'NF',
  NOT_APPROVED: 'NA',
  APPROVED: 'A',
  SUBMITTED_FOR_REVIEW: 'SR',
  SUBMITTED_FOR_FINAL_DECISION: 'SFD',
  RECOMMEND_READY: 'RR',
  RECOMMEND_NOT_READY: 'RNR',
  RECOMMEND_FOR_SUBMISSION: 'RFS',
  READY_FOR_FINAL_DECISION: 'RFD',
  AWAITING_CONFIRMATION: 'AC',
  STANDS_REVIEW: 'MSR',
  STANDS_NOT_REVIEWED: 'SNR',
  MANDATORY_AMENDMENT_STAFF: 'APS',
  AMENDMENT_AH: 'APA',
  SUBMITTED_AS_MANDATORY: 'SAM',
};

export const MINISTER_ISSUE_ACTION_TYPE = {
  OTHER: 'Other',
  TIMING: 'Timing',
};

export const PURPOSE_OF_ACTION = ['establish', 'maintain', 'none'];

export const PLANT_COMMUNITY_CRITERIA = [
  'rangereadiness',
  'stubbleheight',
  'shrubuse',
];

export const AMENDMENT_TYPE = {
  MINOR: 'MNA',
  MANDATORY: 'MA',
  INITIAL: 'A',
};

export const PLAN_EXTENSION_STATUS = {
  AWAITING_VOTES: 1,
  AGREEMENT_HOLDER_REJECTED: 2,
  STAFF_REJECTED: 6,
  DISTRICT_MANAGER_REJECTED: 7,
  AWAITING_EXTENSION: 3,
  EXTENDED: 4,
  IS_EXTENSION: 5,
};

export const NOT_PROVIDED = 'Not provided';
