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
// Created by Jason Leach on 2018-03-14.
//

/* eslint-env es6 */

'use strict';

/* eslint-disable no-param-reassign */

module.exports = {
  up: async (queryInterface) => {
    const ref = [
      {
        description: 'Left Ear',
        active: true,
      },
      {
        description: 'Right Ear',
        active: true,
      },
      {
        description: 'Left Sholder',
        active: true,
      },
      {
        description: 'Right Sholder',
        active: true,
      },
      {
        description: 'Left Hind',
        active: true,
      },
      {
        description: 'Right Hind',
        active: true,
      },
      {
        description: 'Left Flank',
        active: true,
      },
      {
        description: 'Right Flank',
        active: true,
      }];

    await queryInterface.bulkInsert('ref_livestock_identifier_location', ref, {});
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('ref_livestock_identifier_location', null, {});
  },
};
