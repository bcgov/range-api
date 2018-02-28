//
// MyRA
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
// Created by Jason Leach on 2018-02-27.
//

/* eslint-env es6 */

'use strict';

/* eslint-disable no-param-reassign */

module.exports = {
  up: async (queryInterface) => {
    const ref = [{
      name: 'LIVESTOCK_TYPE',
      value: JSON.stringify({
        ALPACA: 'Alpaca',
        ASS: 'Ass',
        BULL: 'Bull',
        COW: 'COW',
        COW_CALF: 'Cow w/ Calf',
        GOAT: 'Goat',
        HORSE: 'Horse',
        LLAMA: 'Llama',
        MULE: 'Mule',
        SHEEP: 'Sheep',
        YEARLING: 'Yearling',
      }),
      active: true,
    }, {
      name: 'LIVESTOCK_AUFACTOR',
      value: JSON.stringify({
        ALPACA: 0.1,
        ASS: 1.25,
        BULL: 1.5,
        COW: 1,
        COW_CALF: 1,
        GOAT: 0.2,
        HOARS: 1.25,
        LLAMA: 0.2,
        MULE: 1.25,
        SHEEP: 0.2,
        YEARLING: 0.7,
      }),
      active: true,
    }, {
      name: 'PC_RANGELAND_HEALTH',
      value: JSON.stringify({
        HIGH: 'Highly at Risk',
        MODERATE: 'Moderatly at Risk',
        LOW: 'Low Risk',
        NON_FUNCTIONAL: 'Non Functional',
        FUNCTIONAL: 'Properly Funcitonal (PFC)',
      }),
      active: true,
    }, {
      name: 'PC_ACTION_TYPE', // BASE
      value: JSON.stringify({
        HERDING: 'Herding',
        TIMING: 'Timing',
        SALTING: 'Salting',
        SUPPLEMENTAL_FEEDING: 'Supplemental Feeding',
        LIVESTOCK_VARIABLES: 'Livestock Variables',
      }),
      active: true,
    }, {
      name: 'PC_ACTION_PURPOSE',
      value: JSON.stringify({
        ESTABLISH: 'Establish',
        MAINTAIN: 'Maintain',
      }),
      active: true,
    }, {
      name: 'ELEVATION',
      value: JSON.stringify({
        UNDER_500: '<500',
        OVER_1500: '>1500',
        BETWEEN_500_699: '500-699',
        BETWEEN_700_899: '700-899',
        BETWEEN_900_1099: '900-1099',
        BETWEEN_1100_1299: '1100-1299',
        BETWEEN_1299_1500: '1299-1500',
      }),
      active: true,
    }, {
      name: 'ASPECT',
      value: JSON.stringify({
        N: 'North',
        E: 'East',
        S: 'South',
        W: 'West',
        NE: 'North East',
        NW: 'North West',
        SE: 'South East',
        SW: 'South West',
      }),
      active: true,
    },
    {
      name: 'LIVESTOCK_ID_LOCATION', // BASE
      value: JSON.stringify({
        LEFT_EAR: 'Left Ear',
        RIGHT_EAR: 'Right Ear',
        LEFT_SHOLDER: 'Left Sholder',
        RIGHT_SHOLDER: 'Right Sholder',
        LEFT_HIND: 'Left Hind',
        RIGHT_HIND: 'Right Hind',
        LEFT_FLANK: 'Left Flank',
        RIGHT_LFANG: 'Right Flank',
      }),
      active: true,
    }, {
      name: 'AGREEMENT_TYPE',
      value: JSON.stringify({
        E01: 'E01',
        E02: 'E02',
        H01: 'H01',
        H02: 'H02',
      }),
      active: true,
    },
    {
      name: 'EXEMPTION_STATUS',
      value: JSON.stringify({
        NOT_EXEMPT: 'Not Exempt',
        PENDING_APPROVAL: 'Pending Approval',
      }),
      active: true,
    }, {
      name: 'RUP_STATUS',
      value: JSON.stringify({
        DRAFT: 'Draft',
        FINAL: 'Final',
        RETIRED: 'Retired',
      }),
      active: true,
    }, {
      name: 'LIVESTOCK_ID_TYPE', // BASE
      value: JSON.stringify({
        BRAND: 'Brand',
        TAG: 'Tag',
      }),
      active: true,
    }];

    ref.forEach((data) => {
      data.created_at = new Date();
      data.updated_at = new Date();
    });

    await queryInterface.bulkInsert('app_reference', ref, {});
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('app_reference', null, {});
  },
};
