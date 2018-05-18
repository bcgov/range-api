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
// Created by Jason Leach on 2018-02-27.
//

/* eslint-env es6 */

'use strict';

/* eslint-disable no-param-reassign */

module.exports = {
  up: async (queryInterface) => {
    const ref = [
      {
        name: 'Bentgrass',
      }, {
        name: 'Bluegrass; Alkali',
        stubbleHeight: 8,
      }, {
        name: 'Bluegrass; Alpine',
        leafStage: 2.5,
        stubbleHeight: 8,
      }, {
        name: 'Bluegrass; Canada',
        leafStage: 2.5,
        stubbleHeight: 8,
      }, {
        name: 'Bluegrass; Cusick\'s',
        leafStage: 2.5,
        stubbleHeight: 8,
      }, {
        name: 'Bluegrass; Fowl',
        leafStage: 2.5,
        stubbleHeight: 8,
      }, {
        name: 'Bluegrass; Kentucky',
        leafStage: 2.5,
        stubbleHeight: 8,
      }, {
        name: 'Bluegrass; Sandberg',
        leafStage: 2.5,
      }, {
        name: 'Brome; California',
      }, {
        name: 'Brome; Fringed',
        leafStage: 3,
        stubbleHeight: 10,
      }, {
        name: 'Brome; Japanese',
        leafStage: 3,
        stubbleHeight: 10,
      }, {
        name: 'Brome; Pumpelly',
        leafStage: 3,
        stubbleHeight: 10,
      }, {
        name: 'Brome; Smooth',
        leafStage: 3,
        stubbleHeight: 10,
      }, {
        name: 'Cheatgrass',
      }, {
        name: 'Fescue; Altai',
        leafStage: 4.5,
        stubbleHeight: 17,
      }, {
        name: 'Fescue; Creeping Red',
        stubbleHeight: 7,
      }, {
        name: 'Fescue; Idaho',
        leafStage: 4,
        stubbleHeight: 12,
      }, {
        name: 'Fescue; Rough',
        leafStage: 4.5,
        stubbleHeight: 17,
      }, {
        name: 'Fescue; Western',
      }, {
        name: 'Foxtail Barley',
      }, {
        name: 'Hairgrass; tufted',
        leafStage: 4,
      }, {
        name: 'Junegrass',
      }, {
        name: 'Mannagrass',
      }, {
        name: 'Mat Muhly',
      }, {
        name: 'Needle-and-thread grass',
        leafStage: 3,
        stubbleHeight: 12,
      }, {
        name: 'Needlegrass; Columbia',
        leafStage: 3,
        stubbleHeight: 12,
      }, {
        name: 'Needlegrass; Green',
        stubbleHeight: 12,
      }, {
        name: 'Needlegrass; Richardson\'s',
        stubbleHeight: 12,
      }, {
        name: 'Needlegrass; Stiff',
        leafStage: 3,
        stubbleHeight: 12,
      }, {
        name: 'Nuttal\'s alkaligrass',
      }, {
        name: 'Orchard grass',
        leafStage: 3,
        stubbleHeight: 10,
      }, {
        name: 'Pinegrass',
        leafStage: 2.5,
        stubbleHeight: 15,
      }, {
        name: 'Porcupine Grass',
        leafStage: 3,
      }, {
        name: 'Reedgrass; Canada',
        leafStage: 3,
      }, {
        name: 'Reedgrass; Purple',
      }, {
        name: 'Ricegrass; Indian',
      }, {
        name: 'Ricegrass; Rough-leaved',
        leafStage: 3,
        stubbleHeight: 8,
      }, {
        name: 'Saltgrass',
      }, {
        name: 'Sedge; beaked',
      }, {
        name: 'Sedge; Field',
      }, {
        name: 'Sedge; Smooth black',
      }, {
        name: 'Threeawn',
      }, {
        name: 'Timber oatgrass',
      }, {
        name: 'Timothy; Alpine',
        stubbleHeight: 10,
      }, {
        name: 'Timothy; domestic',
        stubbleHeight: 8,
      }, {
        name: 'Trisetum; nodding',
      }, {
        name: 'Trisetum; Spike',
      }, {
        name: 'Wheatgrass; bluebunch',
        leafStage: 4,
        stubbleHeight: 15,
      }, {
        name: 'Wheatgrass; crested',
        leafStage: 3.5,
        stubbleHeight: 8,
      }, {
        name: 'Wheatgrass; northern',
        leafStage: 5.5,
        stubbleHeight: 15,
      }, {
        name: 'Wheatgrass; Slender',
        leafStage: 4,
        stubbleHeight: 15,
      }, {
        name: 'Wheatgrass; western',
        leafStage: 4,
        stubbleHeight: 12,
      }, {
        name: 'Wildrye; Blue',
        leafStage: 4,
        stubbleHeight: 15,
      }, {
        name: 'Wildrye; Canada',
      }, {
        name: 'Wildrye; Giant',
      },
    ];

    ref.forEach((data) => {
      data.created_at = new Date();
      data.updated_at = new Date();
      data.active = true;
    });

    await queryInterface.bulkInsert('ref_readiness', ref, {});
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('ref_readiness', null, {});
  },
};
