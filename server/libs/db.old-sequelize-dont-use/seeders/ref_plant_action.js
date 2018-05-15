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
// Created by Jason Leach on 2018-03-07.
//

/* eslint-env es6 */

'use strict';

/* eslint-disable no-param-reassign */

module.exports = {
  up: async (queryInterface) => {
    const ref = [
      {
        description: 'Any work will begin in un-infested areas befor moving to infested locations.',
        default: true,
        active: true,
      },
      {
        description: 'Clothing and vehicle / equipment undercarriages will be regularily inspected for plant parts or' +
        'propagules if working in an area known to contain invasive plants.',
        default: true,
        active: true,
      },
      {
        description: 'Equipment and vehicles will not be parked on invasive plant infestations.',
        default: true,
        active: true,
      },
      {
        description: 'Revegetate disturbed areas that hve exposed mineral soil within one year of disturbance by' +
       'seeding using Common #1 Forage Misture or better. The certificate of seed analysis will be requested and' +
       'seed that contains weed seeds of listed invasive plants and/or invasive plants that are hight priority to' +
       'the area will be rejected. Seeding will occur around range developments and areas of cattle congregation' +
       'where bare soil is exposed. Revegitated areas will be monitored and revegetated as necessary until exposed' +
       'soil is eliminated.',
        default: true,
        active: true,
      },
    ];

    await queryInterface.bulkInsert('ref_plant_action', ref, {});
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('ref_plant_action', null, {});
  },
};
