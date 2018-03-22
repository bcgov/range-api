//
// MyRA
//
// Copyright © 2018 Province of British Columbia
//
// Licensed under the Apache License, Version 2.0 (the License);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an AS IS BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Created by Jason Leach on 2018-03-22.
//

/* eslint-env es6 */

'use strict';

/* eslint-disable no-param-reassign */

module.exports = {
  up: async (queryInterface) => {
    const ref = [
      {
        code: 'N',
        description: 'Not Exempt',
        active: true,
      },
      {
        code: 'PA',
        description: 'Preparing and Obtaining Approval',
        active: true,
      },
      {
        code: 'OA',
        description: 'Obtaining Approval',
        active: true,
      },
    ];

    await queryInterface.bulkInsert('ref_agreement_exemption_status', ref, {});
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('ref_agreement_exemption_status', null, {});
  },
};
