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
// Created by Jason Leach on 2018-05-04.
//

/* eslint-disable no-param-reassign */

'use strict';

exports.seed = async (knex) => {
  let did = 0;
  let zid = 0;
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
    }, {
      code: 'DKA',
      description: '',
    }, {
      code: 'DPC',
      description: '',
    }, {
      code: 'DNI',
      description: '',
    }, {
      code: 'TST',
      description: 'Dummy district for testing',
    },
  ].map((district) => {
    did += 1;
    return { ...district, id: did };
  });
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
      description: 'Merritt Zone',
    }, {
      code: 'MER2',
      district: 'DCS',
      description: 'Merritt Zone',
    }, {
      code: 'MER3',
      district: 'DCS',
      description: 'Merritt Zone',
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
      district: 'DPC',
      description: 'North Peace',
    }, {
      code: 'SPC',
      district: 'DPC',
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
      code: 'HAID',
      district: 'DQC',
      description: 'Haida Gwaii District',
    }, {
      code: 'SAYW',
      district: 'DCR',
      description: 'Campbell River',
    },
    {
      code: 'ALL',
      district: 'DSE',
      description: 'Selkirk',
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
    }, {
      code: 'KAMC',
      district: 'DKA',
      description: 'Kamloops Zone',
    }, {
      code: 'KAMB',
      district: 'DKA',
      description: 'Kamloops Zone',
    }, {
      code: 'KAMA',
      district: 'DKA',
      description: 'Kamloops Zone',
    }, {
      code: 'TEST1',
      district: 'TST',
      description: 'First Test Zone',
    }, {
      code: 'TEST2',
      district: 'TST',
      description: 'Second Test Zone',
    }, {
      code: 'TEST3',
      district: 'TST',
      description: 'Third Test Zone',
    }, {
      code: 'TEST4',
      district: 'TST',
      description: 'Fourth Test Zone',
    }, {
      code: 'TEST5',
      district: 'TST',
      description: 'Fifth Test Zone',
    }, {
      code: 'TEST6',
      district: 'TST',
      description: 'Fifth Test Zone',
    },
  ].map((zone) => {
    zid += 1;
    return { ...zone, id: zid };
  });

  zones.forEach((zone) => {
    const district = districts.filter(aDistrict => aDistrict.code === zone.district).pop();
    if (district) {
      zone.district_id = district.id;
    }

    delete zone.district;
  });
  await knex('ref_zone').delete();
  await knex('ref_district').delete();

  await knex('ref_district').insert(districts);
  await knex.schema.raw(`ALTER SEQUENCE ref_district_id_seq RESTART WITH ${did + 1};`);

  await knex('ref_zone').insert(zones);
  await knex.schema.raw(`ALTER SEQUENCE ref_zone_id_seq RESTART WITH ${zid + 1};`);
};
