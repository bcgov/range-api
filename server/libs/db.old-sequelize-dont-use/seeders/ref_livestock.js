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
// Created by Jason Leach on 2018-03-11.
//

/* eslint-env es6 */

'use strict';

/* eslint-disable no-param-reassign */

module.exports = {
  up: async (queryInterface) => {
    const ref = [
      {
        name: 'Alpaca',
        au_factor: 0.1,
        active: true,
      },
      {
        name: 'Ass',
        au_factor: 1.25,
        active: true,
      },
      {
        name: 'Bull',
        au_factor: '1.5',
        active: true,
      },
      {
        name: 'Cow with Calf',
        au_factor: 1,
        active: true,
      },
      {
        name: 'Goat',
        au_factor: 0.2,
        active: true,
      },
      {
        name: 'Horse',
        au_factor: 1.25,
        active: true,
      },
      {
        name: 'Llama',
        au_factor: 0.2,
        active: true,
      },
      {
        name: 'Mule',
        au_factor: 1.25,
        active: true,
      },
      {
        name: 'Sheep',
        au_factor: 0.2,
        active: true,
      },
      {
        name: 'Yearling',
        au_factor: 0.7,
        active: true,
      }];

    await queryInterface.bulkInsert('ref_livestock', ref, {});
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('ref_livestock', null, {});
  },
};
