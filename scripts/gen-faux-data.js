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
  LivestockIdentifier,
  LivestockIdentifierLocation,
  LivestockIdentifierType,
  Pasture,
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
        id: Math.floor(Math.random()*(-56)+57),
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
        code: 'S',
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

const createPasture = async (agreementId) => {
  try {
    // Just testing transactions here. Its not required.
    const t = await dm.sequelize.transaction();

    const ag = await Agreement.findById(agreementId, {transaction: t});

    const p1 = await Pasture.create({
      name: faker.address.streetName(),
      allowableAum: 400,
      graceDays: 10,
      pdlPercent: 0.10,
      agreement_id: ag.id,
    }, {transaction: t});

    const p2 = await Pasture.create({
      name: faker.address.streetName(),
      allowableAum: 400,
      graceDays: 10,
      pdlPercent: 0.10,
      agreement_id: ag.id,
    }, {transaction: t});

    // await ag.addPasture(p1, {transaction: t});
    // await ag.addPasture(ag, {transaction: t});

    // await p1.save()
    // await p2.save()

    await t.commit();

    return [p1.id, p2.id];
  } catch (err) {
    console.log(err);
  }
}

const createGrazingSchedule = async (agreementId, pastureIds) => {
  try {

    const [ pid1, pid2 ] = pastureIds;
    const lty1 = await LivestockType.findById(1); // Alpaca
    const lty2 = await LivestockType.findById(2); // Alpaca

    const gs = await GrazingSchedule.create({
      year: '2018',
      description: 'This is a grazing schedule description.',
    });

    const gse1 = await GrazingScheduleEntry.create({
      startDate: new Date(),
      endDate: (new Date()).setDate((new Date()).getDate() + 1*365),
      livestockCount: 100,
      dateIn: new Date(),
      dateOut: (new Date()).setDate((new Date()).getDate() + 30),
      livestock_type_id: lty1.id,
      grazing_schedule_id: gs.id,
      pasture_id: pid1,
    });

    const gse2 = await GrazingScheduleEntry.create({
      startDate: new Date(),
      endDate: (new Date()).setDate((new Date()).getDate() + 1*365),
      livestockCount: 200,
      dateIn: new Date(),
      dateOut: (new Date()).setDate((new Date()).getDate() + 30),
      livestock_type_id: lty2.id,
      grazing_schedule_id: gs.id,
      pasture_id: pid2,
    });
    
    const agreement = await Agreement.findById(agreementId);

    await agreement.addGrazingSchedule(gs);

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

const createLivestockIdentifier = async (agreementId) => {
  try {
    const lil1 = await LivestockIdentifierLocation.findById(1); //tag loc
    const lil2 = await LivestockIdentifierLocation.findById(3); //brand loc

    const lit1 = await LivestockIdentifierType.findById(1); // brand
    const lit2 = await LivestockIdentifierType.findById(2); // gag

    const li1 = await LivestockIdentifier.create({
      livestock_identifier_location_id: lil2.id,
      livestock_identifier_type_id: lit1.id,
      agreement_id: agreementId,
    });

    const li2 = await LivestockIdentifier.create({
      livestock_identifier_location_id: lil1.id,
      livestock_identifier_type_id: lit2.id,
      agreement_id: agreementId
    });

    return [li1.id, li2.id];
  } catch (err) {
    console.log(err);
  }
}

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
            model: LivestockIdentifier,
            include: [LivestockIdentifierLocation, LivestockIdentifierType],
            attributes: {
              exclude: ['livestock_identifier_type_id', 'livestock_identifier_location_id'],
            },
          },
          {
            model: Pasture,
          },
          {
            model: GrazingSchedule,
            include: [{
              model: GrazingScheduleEntry,
              include: [LivestockType, Pasture],
              attributes: {
                exclude: ['grazing_schedule_id', 'livestock_type_id', 'agreement_grazing_schedule'],
              },
            }],
          },
          {
            model: Client,
            as: 'primaryAgreementHolder',
            attributes: {
              exclude: ['client_type_id'],
            }
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

    // const ag = agreement.get({plain: true});
    // console.log(ag.livestockIdentifiers);

    assert(agreement);
    assert(agreement.id === agreementId);
    assert(agreement.zone);
    assert(agreement.zone.district);
    assert(agreement.pastures.length >= 2);
    assert(agreement.primaryAgreementHolder);
    assert(agreement.livestockIdentifiers.length >= 2);
    assert(agreement.livestockIdentifiers[0].livestockIdentifierLocation);
    assert(agreement.livestockIdentifiers[0].livestockIdentifierType);
    assert(agreement.grazingSchedules.length > 0);
    assert(agreement.grazingSchedules[0].grazingScheduleEntries.length === 2);
    assert(agreement.grazingSchedules[0].grazingScheduleEntries[0].livestockType);
    assert(agreement.grazingSchedules[0].grazingScheduleEntries[0].pasture);
    assert(agreement.usage.length > 0);

    console.log('TEST OK!');
  } catch (err) {
    console.log(`test error, ${err}`);
  }
};

const main = async () => {
  const clientId = await createClient();
  const agreementId = await createAgreement(clientId);
  const pastureIds = await createPasture(agreementId);
  const grazingScheduleId = await createGrazingSchedule(agreementId, pastureIds);
  const usageId = await createUsage(agreementId);
  const livestockIdenfifierIds = await createLivestockIdentifier(agreementId);

  await test(agreementId);

  process.exit(0);
};

main();
