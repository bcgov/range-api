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
// Created by Jason Leach on 2018-03-16.
//

/* eslint-env es6 */

'use strict';

/* eslint-disable no-param-reassign */

module.exports = {
  up: async (queryInterface) => {
    const ref = [
      {
        code: 'N',
        description: 'North',
        active: true,
      },
      {
        code: 'E',
        description: 'East',
        active: true,
      },
      {
        code: 'S',
        description: 'South',
        active: true,
      },
      {
        code: 'W',
        description: 'West',
        active: true,
      },
      {
        code: 'NE',
        description: 'North East',
        active: true,
      },
      {
        code: 'NW',
        description: 'North West',
        active: true,
      },
      {
        code: 'SE',
        description: 'South East',
        active: true,
      },
      {
        code: 'SW',
        description: 'South West',
        active: true,
      },
    ];

    await queryInterface.bulkInsert('ref_plant_community_aspect', ref, {});
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('ref_plant_community_aspect', null, {});
  },
};
