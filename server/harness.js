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

import config from './config';
import DataManager from './libs/db';
import {
  LIVESTOCK_ID_TYPE,
  LIVESTOCK_ID_LOCATION,
  LIVESTOCK_TYPE,
} from './libs/db/constants';

const dm = new DataManager(config);
const {
  Agreement,
  District,
  Zone,
  LivestockIdentifier,
  Usage,
  Extension,
  Pasture,
  PastureSchedule,
  PastureScheduleEntry
} = dm;

const sync = async (force = false) => {
  try {
    await dm.sequelize
      .sync({
        force,
      });
  } catch (error) {
    console.log(error);
  }

  process.exit(0);
};

const applicationZones = async () => {
  try {
    const zone = await Zone.findOne({
      where: {
        code: 'BEAV',
      },
      include: [District],
    });

    const ag1 = await Agreement.create({
      ran: 'RAN123',
      type: 'E01',
      name: 'My Amazing Farm',
    });

    await ag1.setZone(zone);
    await ag1.save();

    await zone.addAgreement(ag1);
    await zone.save();

    const ag2 = await Agreement.findOne({
      where: {
        id: ag1.id,
      },
      include: [Zone],
    });

    console.log('applicationZones Report');
    console.log(`Fetched Zone code = ${zone.code}, district code = ${zone.district.code}`);
    console.log(`Created Agreement ID = ${ag1.id}, zone = ${typeof ag1.zone === 'undefined' ? 'NONE' : ag1.zone.code}`);
    console.log(`Fetched Agreement ID = ${ag2.id}, zone = ${ag2.zone.code}`);
  } catch (err) {
    console.log(err);
  }
};

const districtZone = async () => {
  try {
    const zone = await Zone.findOne({
      where: {
        code: 'BEAV',
      },
      include: [District],
    });


    const district = await District.findOne({
      where: {
        code: zone.district.code,
      },
      include: [Zone],
    });

    console.log('districtZone Report');
    console.log(`Fetched Zone code = ${zone.code}, district code = ${zone.district.code}`);
    console.log(`Fetched District code = ${district.code}, zone count = ${district.zones.length}`);
  } catch (error) {
    console.log(error);
  }
};

const agreementLivestockIdentifier1 = async () => {
  try {
    const ag1 = await Agreement.create({
      ran: 'RAN888',
      type: 'E02',
      name: 'My Amazing Other Farm',
    });

    const lid1 = await LivestockIdentifier.create({
      type: LIVESTOCK_ID_TYPE.TAG,
      location: LIVESTOCK_ID_LOCATION.LEFT_EAR,
      description: 'My Amazing Farm',
    });

    const lid2 = await LivestockIdentifier.create({
      type: LIVESTOCK_ID_TYPE.BRAND,
      location: LIVESTOCK_ID_LOCATION.LEFT_SHOLDER,
      description: 'My Amazing Farm',
    });

    await ag1.addLivestockIdentifier([lid1, lid2]);
    await ag1.save();

    const ag2 = await Agreement.findOne({
      where: {
        id: ag1.id,
      },
      include: [LivestockIdentifier],
    });

    console.log('agreementLivestockIdentifier1 Report');
    console.log(`Agreement ID = ${ag2.id}, Livestock Identifiers count = ${ag2.livestockIdentifiers.length}`);
    console.log('Done');
  } catch (error) {
    console.log(error);
  }
};


// not working.
const agreementLivestockIdentifier2 = async () => {
  try {
    const lid1 = await Identifier.create({
      type: LIVESTOCK_ID_TYPE.TAG,
      location: LIVESTOCK_ID_LOCATION.LEFT_EAR,
      description: 'My Amazing Farm',
    });

    await lid1.save();

    const ag1 = await Agreement.create({
      ran: 'RAN888',
      type: 'E02',
      name: 'My Amazing Other Farm',
      identifier: lid1,
    }, {
      include: [{
        model: Identifier,
        as: 'livestockIdentifiers',
      }],
    });

    await ag1.save();

    const ag2 = await Agreement.findOne({
      where: {
        id: ag1.id,
      },
      include: [{
        model: Identifier,
        as: 'livestockIdentifiers',
      }],
    });

    console.log('agreementLivestockIdentifier2 Report');
    console.log(`Agreement ID = ${ag2.id}, Livestock Identifiers count = ${ag2.livestockIdentifiers.length}`);
    console.log('Done');
  } catch (error) {
    console.log(error);
  }
};

const agreementUsage = async () => {
  try {
    const u1 = await Usage.create({
      year: 2017,
      authorizedAmu: 300,
    });

    const u2 = await Usage.create({
      year: 2018,
      authorizedAmu: 400,
    });

    const ag1 = await Agreement.create({
      ran: 'RAN888',
      type: 'E02',
      name: 'My Amazing Other Farm',
    });

    await ag1.addUsages([u1, u2]);
    await ag1.save();

    const ag2 = await Agreement.findOne({
      where: {
        id: ag1.id,
      },
      include: [Usage],
    });

    console.log('agreementUsage Report');
    console.log(`Agreement ID = ${ag2.id}, Usage count = ${ag2.usages.length}`);
    console.log('Done');
  } catch (error) {
    console.log(error);
  }
}

const agreementExtension = async () => {
  try {
    const e1 = await Extension.create({
      requestDate: new Date(),
      endDate: new Date(),
    });

    const ag1 = await Agreement.create({
      ran: 'RAN888',
      type: 'E02',
      name: 'My Amazing Other Farm',
    });

    await ag1.setExtension(e1);
    await ag1.save();

    const ag2 = await Agreement.findOne({
      where: {
        id: ag1.id,
      },
      include: [Extension],
    });

    console.log('agreementExtension Report');
    console.log(`Agreement ID = ${ag2.id}, has extension = ${ag2.extension ? 'YES' : 'NO'}`);
    console.log('Done');
  } catch (error) {
    console.log(error);
  }
}

// allowableAmu: {
//   field: 'allowable_amu',
//   type: DataTypes.INTEGER,
//   allowNull: false,
// },
// graceDays: {
//   field: 'grace_days',
//   type: DataTypes.INTEGER,
//   allowNull: false,
//   default: 0,
// },
// pdlPercent: {
//   field: 'pdl_percent',
//   type: DataTypes.FLOAT,
//   allowNull: false,
//   default: 0,
// },

const pastureScheduel = async () => {
  try {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 14);

    const p1 = await Pasture.create({
      name: 'Hello Pasture',
      allowableAmu: 300,
      graceDays: 5,
      pdlPercent: 0.12,
    });

    const ps1 = await PastureSchedule.create({
      year: '2018',
      description: 'Foo Bar',
      pastureScheduleEntries: [{
        startDate: new Date(),
        endDate,
        graceDays: 5,
        livestockCount: 100,
        livestockType: LIVESTOCK_TYPE.GOAT,
      }, {
        startDate: new Date(),
        endDate,
        graceDays: 10,
        livestockCount: 10,
        livestockType: LIVESTOCK_TYPE.COW,
      }],
    }, {
      include: [PastureScheduleEntry]
    });

    await p1.addPastureSchedule(ps1);
    await p1.save();

    const p2 = await Pasture.findOne({
      where: {
        id: p1.id,
      },
      include: [{
        model: PastureSchedule,
        include: [PastureScheduleEntry]
      }],
    });

    console.log('pastureScheduel Report');
    console.log(`Pasture ID = ${p2.id}, Schedule count = ${p2.pastureSchedules.length}`);
    console.log(`Schedule entry count = ${p2.pastureSchedules[0].pastureScheduleEntries.length}`);
    console.log('Done');
  } catch (error) {
    console.log(error);
  }
}

sync(true);

// districtZone();
// applicationZones();
// agreementLivestockIdentifier1();
// agreementUsage();
// agreementExtension();
// pastureScheduel();

// agreementLivestockIdentifier2(); // not working
