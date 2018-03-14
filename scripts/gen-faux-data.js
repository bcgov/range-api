//
// SecureImage
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
// Created by Jason Leach on 2018-01-10.
//

/* eslint-env es6 */
/* eslint-disable */

/* 
                        INSTRUCTIONS

Add the db logic here in a seprate funciton that you want to test. 
Make sure you cadd a call at the end of the file. Then use the following
to run this script:

./node_modules/.bin/babel-node server/harness.js
*/

'use strict';

import assert from 'assert';
import config from '../server//config';
import DataManager from '../server/libs/db';
import faker from 'faker';

const dm = new DataManager(config);
const {
  Agreement,
  AgreementType,
  AgreementStatus,
  District,
  Extension,
  Zone,
  Client,
  ClientType,
  LivestockType,
  GrazingSchedule,
  GrazingScheduleEntry,
  Usage,
} = dm;

const sync = async (force = false) => dm.sequelize.sync({ force });

const createClient = async () => {
  try {
    const ctype = await ClientType.findOne({
      where: {
        code: 'A',
      },
    });

    const client = await Client.create({
      id: `00465${Math.floor(Math.random()*(999-100+1)+100)}`,
      name: faker.name.findName(),
      location: 'XX',
      client_type_id: ctype.id,
    });

    console.log(`Created Client with ID = ${client.id}`);

    return client.id;
  } catch (err) {
    console.log(err);
  }
};

const createAgreement = async (clientId) => {
  try {
    const zone = await Zone.findOne({
      where: {
        code: 'BEAV',
      },
      include: [District],
    });

    const type = await AgreementType.findOne({
      where: {
        code: 'E02',
      }
    });

    const status = await AgreementStatus.findOne({
      where: {
        code: 'N',
      }
    });

    const ag1 = await Agreement.build({
      agreementId: `RAN123${Math.floor(Math.random()*(999-100+1)+100)}`,
      rangeName: faker.company.companyName(),
      agreementStartDate: new Date(),
      agreementEndDate: (new Date()).setDate((new Date()).getDate() + 25*365),
      zone_id: zone.id,
      agreement_type_id: type.id,
      status_id: status.id,
      primary_agreement_holder_id: clientId,
    });

    const agreement = await ag1.save();

    console.log(`Created Agreement with ID = ${agreement.id}`);

    return  agreement.id;
  } catch (err) {
    console.log(err);
  }
};

const createGrazingSchedule = async (agreementId) => {
  try {

    const lty1 = await LivestockType.findById(1); // Alpaca
    const lty2 = await LivestockType.findById(2); // Alpaca

    const gs = await GrazingSchedule.create({
      year: '2018',
      description: 'This is a grazing schedule description.',
    });

    const gse1 = await GrazingScheduleEntry.create({
      startDate: new Date(),
      endDate: new Date(),
      livestockCount: 100,
      livestock_type_id: lty1.id,
      grazing_schedule_id: gs.id,
    });

    const gse2 = await GrazingScheduleEntry.create({
      startDate: new Date(),
      endDate: new Date(),
      livestockCount: 200,
      livestock_type_id: lty2.id,
      grazing_schedule_id: gs.id,
    });
    
    const agreement = await Agreement.findById(agreementId);

    await agreement.addGrazingSchedule(gs);
    // await agreement.save();

    return gs.id;
  } catch (err) {
    console.log(err);
  }
};

const createUsage = async (agreementId) => {
  try {
    const usage = await Usage.build({
      year: '2018',
      authorizedAmu: 'This is a grazing schedule description.',
      authorizedAum: 1400,
      agreement_id: agreementId,
    })

    await usage.save();

    return usage.id;
  } catch (err) {
    console.log(err);
  }
};

const test = async (agreementId) => {
  try {
    const agreement = await Agreement.findById(agreementId, {
      include: [{
            model: Zone,
            include: [District],
            attributes: {
              exclude: ['district_id'],
            },
          },
          {
            model: GrazingSchedule,
            include: [{
              model: GrazingScheduleEntry,
              include: [LivestockType],
              attributes: {
                exclude: ['grazing_schedule_id', 'livestock_type_id'],
              },
            }],
          },
          {
            model: Client,
            as: 'primaryAgreementHolder',
          },
          {
            model: Usage,
            as: 'usage',
            attributes: {
              exclude: ['agreement_id'],
            },
          }
        ],
        attributes: {
          exclude: ['primary_agreement_holder_id', 'agreement_type_id', 'zone_id', 'extension_id', 'status_id'],
        },
      });

    // console.log(agreement.get({plain: true}));

    assert(agreement);
    assert(agreement.id === agreementId);
    assert(agreement.zone);
    assert(agreement.zone.district);
    assert(agreement.primaryAgreementHolder);
    assert(agreement.grazingSchedules.length > 0);
    assert(agreement.grazingSchedules[0].grazingScheduleEntries.length === 2);
    assert(agreement.grazingSchedules[0].grazingScheduleEntries[0].livestockType);
    assert(agreement.usage.length > 0);

    console.log('TEST OK!');
  } catch (error) {
    console.log(`test error, ${error}`);
  }
};

const main = async () => {
  const clientId = await createClient();
  const agreementId = await createAgreement(clientId);
  const grazingScheduleId = await createGrazingSchedule(agreementId);
  const usageId = await createUsage(agreementId);

  await test(agreementId);

  process.exit(0);
};

main();
