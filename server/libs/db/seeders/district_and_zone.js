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
// Created by Jason Leach on 2018-02-21.
//

/* eslint-env es6 */

'use strict';

/* eslint-disable no-param-reassign */

module.exports = {
  up: async (queryInterface) => {
    let did = 1;
    let zid = 1;
    const districts = [
      {
        code: 'DCC',
        description: '',
      }, {
        code: 'DSS',
        description: '',
      }, {
        code: 'DRM',
        description: '',
      }, {
        code: 'DCS',
        description: '',
      }, {
        code: 'DCK',
        description: '',
      }, {
        code: 'DSQ',
        description: '',
      }, {
        code: 'DSE',
        description: '',
      }, {
        code: 'DPG',
        description: '',
      }, {
        code: 'DCP',
        description: '',
      }, {
        code: 'DFN',
        description: '',
      }, {
        code: 'DMH',
        description: '',
      }, {
        code: 'DND',
        description: '',
      }, {
        code: 'DQU',
        description: '',
      }, {
        code: 'DQC',
        description: '',
      }, {
        code: 'DOS',
        description: '',
      }, {
        code: 'DCR',
        description: '',
      }, {
        code: 'DVA',
        description: '',
      }, {
        code: 'DJA',
        description: '',
      }, {
        code: 'DMK',
        description: '',
      },
    ];
    const zones = [
      {
        code: 'CHIM',
        district: 'DCC',
        description: 'Chimney Creek Livestock Assoc',
      }, {
        code: 'HORS',
        district: 'DCC',
        description: 'Horsefly Livestock Assoc',
      }, {
        code: '150M',
        district: 'DCC',
        description: '150 Mile Livestock Assoc',
      }, {
        code: 'ROSE',
        district: 'DCC',
        description: 'Rose Lake-Miocene Livestock',
      }, {
        code: 'RISK',
        district: 'DCC',
        description: 'Riske Creek Livestock Assoc',
      }, {
        code: 'BEAV',
        district: 'DCC',
        description: 'Big and Beaver Livestock',
      }, {
        code: 'BELL',
        district: 'DCC',
        description: 'Bella Coola Area',
      }, {
        code: 'BIGC',
        district: 'DCC',
        description: 'Big Creek Livestock Assoc',
      }, {
        code: 'TATL',
        district: 'DCC',
        description: 'Tatla Lake Livestock Assoc.',
      }, {
        code: 'ANAH',
        district: 'DCC',
        description: 'Anahim Lake Livestock Assoc.',
      }, {
        code: 'CHIL',
        district: 'DCC',
        description: 'Chilcotin Livestock Assoc',
      }, {
        code: 'SODA',
        district: 'DCC',
        description: 'Soda Creek Livestock Assoc',
      }, {
        code: 'BULK',
        district: 'DSS',
        description: 'Bulkley',
      }, {
        code: 'KISP',
        district: 'DSS',
        description: 'Kispiox',
      }, {
        code: 'CASS',
        district: 'DSS',
        description: 'Cassiar',
      }, {
        code: 'NORT',
        district: 'DRM',
        description: 'North',
      }, {
        code: 'EAST',
        district: 'DRM',
        description: 'East',
      }, {
        code: 'WEST',
        district: 'DRM',
        description: 'West',
      }, {
        code: 'CONS',
        district: 'DRM',
        description: 'Conservation Properties',
      }, {
        code: 'GOFT',
        district: 'DRM',
        description: 'Guide outfitters',
      }, {
        code: 'GRAS',
        district: 'DRM',
        description: 'Grasmere',
      }, {
        code: 'MER1',
        district: 'DCS',
        description: 'Merritt Zone ',
      }, {
        code: 'MER2',
        district: 'DCS',
        description: 'Merritt Zone ',
      }, {
        code: 'MER3',
        district: 'DCS',
        description: 'Merritt Zone ',
      }, {
        code: 'PRIN',
        district: 'DCS',
        description: 'Princeton Zone',
      }, {
        code: 'LILL',
        district: 'DCS',
        description: 'Lillooet Zone',
      }, {
        code: 'CHWK',
        district: 'DCK',
        description: 'Chilliwack',
      }, {
        code: 'SQUA',
        district: 'DSQ',
        description: 'Squamish',
      }, {
        code: 'ALL',
        district: 'DSE',
        description: 'Selkirk',
      }, {
        code: 'PRIN',
        district: 'DPG',
        description: 'Prince George',
      }, {
        code: 'HIXN',
        district: 'DPG',
        description: 'Hixon',
      }, {
        code: 'MCBR',
        district: 'DPG',
        description: 'McBride',
      }, {
        code: 'NPC',
        district: 'DCP',
        description: 'North Peace',
      }, {
        code: 'SPC',
        district: 'DCP',
        description: 'South Peace',
      }, {
        code: 'FTN',
        district: 'DFN',
        description: 'Fort Nelson',
      }, {
        code: 'CLIN',
        district: 'DMH',
        description: 'Clinton and District Association',
      }, {
        code: 'LLH',
        district: 'DMH',
        description: 'Lac La Hache Livestock Association',
      }, {
        code: 'LONE',
        district: 'DMH',
        description: 'Lone Butte Farmer\'s Institute',
      }, {
        code: 'CANI',
        district: 'DMH',
        description: 'Canim Lake Livestock Association',
      }, {
        code: 'GLNP',
        district: 'DMH',
        description: 'Green Lake North Bonaparte Association',
      }, {
        code: 'BRID',
        district: 'DMH',
        description: 'Bridge Lake Livestock Association',
      }, {
        code: 'MAHO',
        district: 'DMH',
        description: 'Mahood Lake Livestock Asssociation',
      }, {
        code: 'LANO',
        district: 'DND',
        description: 'Lakes TSA North of Francois Lake',
      }, {
        code: 'LASO',
        district: 'DND',
        description: 'Lakes TSA South of Francois Lake',
      }, {
        code: 'MOR1',
        district: 'DND',
        description: 'Morice TSA',
      }, {
        code: 'WFA',
        district: 'DQU',
        description: 'West Fraser',
      }, {
        code: 'EFA',
        district: 'DQU',
        description: 'East Fraser',
      }, {
        code: 'HAIDA',
        district: 'DQC',
        description: 'Haida Gwaii District',
      }, {
        code: 'SECW',
        district: 'DOS',
        description: 'Southeast Centralwest',
      }, {
        code: 'SWNW',
        district: 'DOS',
        description: 'Southeast Northeast',
      }, {
        code: 'SWNE',
        district: 'DOS',
        description: 'Southwest Northeast',
      }, {
        code: 'SWCW',
        district: 'DOS',
        description: 'Southwest Centralwest',
      }, {
        code: 'SAYW',
        district: 'DCR',
        description: 'Campbell River',
      }, {
        code: 'ALL',
        district: 'DVA',
        description: 'Vanderhoof',
      }, {
        code: 'ALL',
        district: 'DJA',
        description: 'Fort St James',
      }, {
        code: 'ALL',
        district: 'DMK',
        description: 'Mackenzie',
      },
    ];

    districts.forEach((district) => {
      district.id = did;
      did += 1;
    });

    zones.forEach((zone) => {
      zone.id = zid;
      zid += 1;
    });

    const queries = [];
    zones.forEach((zone) => {
      const district = districts.filter(aDistrict => aDistrict.code === zone.district).pop();
      if (district) {
        zone.district_id = district.id;
        queries.push(`INSERT INTO district_zone (created_at, updated_at, district_id, zone_id)
         VALUES (current_timestamp, current_timestamp, ${district.id}, ${zone.id})`);
      }

      delete zone.district;
    });

    await queryInterface.bulkInsert('district', districts, {});
    await queryInterface.sequelize.query(`ALTER SEQUENCE district_id_seq RESTART WITH ${did + 1};`);

    await queryInterface.bulkInsert('zone', zones, {});
    await queryInterface.sequelize.query(`ALTER SEQUENCE zone_id_seq RESTART WITH ${zid + 1};`);

    await Promise.all(queries.map(string => queryInterface.sequelize.query(string)));
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('district', null, {});
    await queryInterface.bulkDelete('zone', null, {});
    await queryInterface.sequelize.query('DELETE FROM district_zone');
  },
};
