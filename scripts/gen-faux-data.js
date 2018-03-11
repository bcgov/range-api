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
          model: Client,
          as: 'primaryAgreementHolder',
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
  } catch (error) {
    console.log(`test error`);
  }
};

const main = async () => {

  const clientId = await createClient();
  const agreementId = await createAgreement(clientId);

  await test(agreementId);

  process.exit(0);
};

main();
