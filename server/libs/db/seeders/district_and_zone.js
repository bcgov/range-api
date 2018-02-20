//
// Copyright (c) 2016 Fullboar Creative, Corp. All rights reserved.
//
// This software and documentation is the confidential and proprietary
// information of Fullboar Creative, Corp.
// (Confidential Information). You shall not disclose such Confidential
// Information and shall use it only in accordance with the terms of the
// license agreement you entered into with Fullboar Creative, Corp.
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
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DSS',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DRM',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DCS',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DCK',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DSQ',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DSE',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DPG',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DCP',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DFN',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DMH',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DND',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DQU',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DQC',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DOS',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DCR',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DVA',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DJA',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'DMK',
        description: '',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];
    const zones = [
      {
        code: 'CHIM',
        district: 'DCC',
        description: 'Chimney Creek Livestock Assoc',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'HORS',
        district: 'DCC',
        description: 'Horsefly Livestock Assoc',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: '150M',
        district: 'DCC',
        description: '150 Mile Livestock Assoc',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'ROSE',
        district: 'DCC',
        description: 'Rose Lake-Miocene Livestock',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'RISK',
        district: 'DCC',
        description: 'Riske Creek Livestock Assoc',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'BEAV',
        district: 'DCC',
        description: 'Big and Beaver Livestock',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'BELL',
        district: 'DCC',
        description: 'Bella Coola Area',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'BIGC',
        district: 'DCC',
        description: 'Big Creek Livestock Assoc',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'TATL',
        district: 'DCC',
        description: 'Tatla Lake Livestock Assoc.',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'ANAH',
        district: 'DCC',
        description: 'Anahim Lake Livestock Assoc.',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'CHIL',
        district: 'DCC',
        description: 'Chilcotin Livestock Assoc',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'SODA',
        district: 'DCC',
        description: 'Soda Creek Livestock Assoc',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'BULK',
        district: 'DSS',
        description: 'Bulkley',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'KISP',
        district: 'DSS',
        description: 'Kispiox',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'CASS',
        district: 'DSS',
        description: 'Cassiar',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'NORT',
        district: 'DRM',
        description: 'North',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'EAST',
        district: 'DRM',
        description: 'East',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'WEST',
        district: 'DRM',
        description: 'West',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'CONS',
        district: 'DRM',
        description: 'Conservation Properties',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'GOFT',
        district: 'DRM',
        description: 'Guide outfitters',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'GRAS',
        district: 'DRM',
        description: 'Grasmere',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'MER1',
        district: 'DCS',
        description: 'Merritt Zone ',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'MER2',
        district: 'DCS',
        description: 'Merritt Zone ',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'MER3',
        district: 'DCS',
        description: 'Merritt Zone ',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'PRIN',
        district: 'DCS',
        description: 'Princeton Zone',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'LILL',
        district: 'DCS',
        description: 'Lillooet Zone',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'CHWK',
        district: 'DCK',
        description: 'Chilliwack',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'SQUA',
        district: 'DSQ',
        description: 'Squamish',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'ALL',
        district: 'DSE',
        description: 'Selkirk',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'PRIN',
        district: 'DPG',
        description: 'Prince George',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'HIXN',
        district: 'DPG',
        description: 'Hixon',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'MCBR',
        district: 'DPG',
        description: 'McBride',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'NPC',
        district: 'DCP',
        description: 'North Peace',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'SPC',
        district: 'DCP',
        description: 'South Peace',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'FTN',
        district: 'DFN',
        description: 'Fort Nelson',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'CLIN',
        district: 'DMH',
        description: 'Clinton and District Association',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'LLH',
        district: 'DMH',
        description: 'Lac La Hache Livestock Association',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'LONE',
        district: 'DMH',
        description: 'Lone Butte Farmer\'s Institute',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'CANI',
        district: 'DMH',
        description: 'Canim Lake Livestock Association',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'GLNP',
        district: 'DMH',
        description: 'Green Lake North Bonaparte Association',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'BRID',
        district: 'DMH',
        description: 'Bridge Lake Livestock Association',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'MAHO',
        district: 'DMH',
        description: 'Mahood Lake Livestock Asssociation',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'LANO',
        district: 'DND',
        description: 'Lakes TSA North of Francois Lake',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'LASO',
        district: 'DND',
        description: 'Lakes TSA South of Francois Lake',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'MOR1',
        district: 'DND',
        description: 'Morice TSA',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'WFA',
        district: 'DQU',
        description: 'West Fraser',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'EFA',
        district: 'DQU',
        description: 'East Fraser',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'HAIDA',
        district: 'DQC',
        description: 'Haida Gwaii District',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'SECW',
        district: 'DOS',
        description: 'Southeast Centralwest',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'SWNW',
        district: 'DOS',
        description: 'Southeast Northeast',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'SWNE',
        district: 'DOS',
        description: 'Southwest Northeast',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'SWCW',
        district: 'DOS',
        description: 'Southwest Centralwest',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'SAYW',
        district: 'DCR',
        description: 'Campbell River',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'ALL',
        district: 'DVA',
        description: 'Vanderhoof',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'ALL',
        district: 'DJA',
        description: 'Fort St James',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'ALL',
        district: 'DMK',
        description: 'Mackenzie',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'KAMA',
        district: 'DKA',
        description: 'Kamloops Zone',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'KAMB',
        district: 'DKA',
        description: 'Kamloops Zone',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'KAMC',
        district: 'DKA',
        description: 'Kamloops Zone',
        created_at: new Date(),
        updated_at: new Date(),
      }, {
        code: 'KAMD',
        district: 'DKA',
        description: 'Kamloops Zone',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    districts.forEach((district) => { district.id = did; did += 1; });
    zones.forEach((zone) => { zone.id = zid; zid += 1; });

    const queries = [];
    zones.forEach((zone) => {
      const district = districts.filter(aDistrict => aDistrict.code === zone.district).pop();
      if (district) {
        queries.push(`UPDATE zone SET district_id=${district.id} WHERE id = ${zone.id}`);
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
    await queryInterface.sequelize.query('DELETE FROM district_zones');
  },
};
