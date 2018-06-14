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
// Created by Jason Leach on 2018-03-21.
//

/* eslint-env es6 */
/* eslint-disable */

'use strict';

import csv from 'csv'
import fs from 'fs'
import DataManager from '../server/libs/db2'
import config from '../server/config'

const USAGE = 'fta/FTA_RANGE_USAGE.csv';
const LICENSEE = 'fta/FTA_RANGE_LICENSEE.csv';
const CLIENT = 'fta/FTA_RANGE_CLIENT.csv';
const USER = 'fta/ZONE_USER.csv';

const dm = new DataManager(config);
const {
  db,
  Agreement,
  AgreementType,
  AgreementExemptionStatus,
  // PlanStatus,
  Client,
  ClientType,
  ClientAgreement,
  District,
  // Extension,
  // GrazingSchedule,
  // GrazingScheduleEntry,
  // LivestockType,
  // LivestockIdentifier,
  // LivestockIdentifierLocation,
  // LivestockIdentifierType,
  // Pasture,
  // PlantCommunity,
  // PlantCommunityAction,
  // PlantCommunityActionPurpose,
  // PlantCommunityActionType,
  // PlantCommunityAspect,
  // PlantCommunityElevation,
  Usage,
  User,
  Zone,
} = dm;

const zip = (arrays) => {
  return arrays[0].map(function(_, i) {
    return arrays.map(function(array) {
      return array[i]
    })
  });
}

const dateFromString = (string) => {
  const [m, d, y] = string.split('/')
  return new Date()
}

const isValidRecord = (record) => {
  if (!/^RAN\d{6}$/.test(record.FOREST_FILE_ID)) {
    return false
  }

  return true
}

const parseDate = (dateAsString) => new Date(dateAsString.replace(/-/g, '/'));

const loadFile = (name) => new Promise((resolve, reject) => {
  const records = [];
  fs.readFile(name, 'utf8', (err, contents) => {
    const parser = csv.parse(contents, (err, data) => {
      if (err) reject(err)

      const fields = data.shift()
      data.forEach((line) => {
        const record = {}
        fields.forEach((value, i) => {
          const key = value.replace(/ /g, '_');
          if (i > 1) {
            record[key] = line[i]
            return
          }
          record[key] = line[i]
        });
        records.push(record);
      })
      resolve(records);
    });
  });
});

const updateAgreement = async (data) => {

  for (var i = 0; i < data.length; i++) {
    const record = data[i]
    if (!isValidRecord(record)) {
      console.log(`Skipping record with ID ${record.FOREST_FILE_ID}`)
      continue
    }

    try {
      const zone = await Zone.findOne(db, {
        code: record.DISTRICT_ADMIN_ZONE
      });

      if (!zone) {
        throw new Error(`No zone with code ${record.DISTRICT_ADMIN_ZONE || 'NULL'}`)
      }

      const atype = await AgreementType.findOne(db, {
        code: record.FILE_TYPE_CODE
      });

      if (!atype) {
        throw new Error(`No AgreementType with code ${record.FILE_TYPE_CODE || 'NULL'}`)
      }

      const exemption = await AgreementExemptionStatus.findOne(db, { code: 'N' }); // Not Exempt

      const agreement = await Agreement.findById(db, record.FOREST_FILE_ID);
      if (!agreement) {
        await Agreement.create(db, {
          forestFileId: record.FOREST_FILE_ID,
          agreementStartDate: new Date(record.LEGAL_EFFECTIVE_DT), // Short Format
          agreementEndDate: new Date(record.INITIAL_EXPIRY_DT), // Short Format
          zoneId: zone.id,
          agreementTypeId: atype.id,
          agreementExemptionStatusId: exemption.id,
        });
      } else {
        await Agreement.update(db, 
          {
            forest_file_id: record.FOREST_FILE_ID,
          }, 
          {
            agreementStartDate: new Date(record.LEGAL_EFFECTIVE_DT), // Short Format
            agreementEndDate: new Date(record.INITIAL_EXPIRY_DT), // Short Format
            zoneId: zone.id,
            agreementTypeId: atype.id,
            agreementExemptionStatusId: exemption.id,
          }
        );
      }

      console.log(`Processed Agreement with ID ${record.FOREST_FILE_ID}`)
    } catch (error) {
      console.log(`Error with message = ${error.message}, ID ${record.FOREST_FILE_ID}`)
    }
  }
}

const updateDistrict = async (data) => {
  for (var i = 0; i < data.length; i++) {
    const record = data[i]

    if (!isValidRecord(record) || !record.ORG_UNIT_CODE) {
      console.log(`Skipping record with ID ${record.FOREST_FILE_ID}`)
      continue
    }

    try {
      let district = await District.findOne(db,
        {
          code: record.ORG_UNIT_CODE
        }
      );

      if (!district) {
        console.log(`Adding District with ID ${record.ORG_UNIT_CODE}`)
        district = await District.create(db, {
          code: record.ORG_UNIT_CODE,
          description: 'No description available',
        })

        // continue
      }

      // district.description = record.XXXXXX || 'No District Description'
    } catch (error) {
      console.log(`Error with message = ${error.message}, District ID ${record.ORG_UNIT_CODE}`)
    }
  }
}

const updateZone = async (data) => {
  for (var i = 0; i < data.length; i++) {
    const record = data[i]

    if (!isValidRecord(record) || !record.DISTRICT_ADMIN_ZONE) {
      console.log(`Skipping record with ID ${record.FOREST_FILE_ID}`)
      continue
    }

    try {
      let zone
      zone = await Zone.findOne(db, {
        code: record.DISTRICT_ADMIN_ZONE
      });

      if (!zone) {
        const district = await District.findOne(db, {
          code: record.ORG_UNIT_CODE
        })

        if (!district) {
          throw new Error(`No District with ID ${record.ORG_UNIT_CODE}`)
        }

        zone = await Zone.create(db, {
          code: record.DISTRICT_ADMIN_ZONE,
          description: record.ZONE_DESCRIPTION || 'No description available',
          districtId: district.id,
        })
      }

      zone.contactName = zone.contactName ? zone.contactName : (record.CONTACT || null)
      zone.contactPhoneNumber = zone.contactPhoneNumber ? zone.contactPhoneNumber : (record.CONTACT_PHONE_NUMBER || null)
      zone.contactEmail = zone.contactEmail ? zone.contactEmail : (record.CONTACT_EMAIL_ADDRESS || null)

      // await zone.save()

      console.log(`Processed Zone with code = ${zone.code}, id = ${zone.id}`)
    } catch (error) {
      console.log(`Can not update Zone. Error = ${error.message}, Zone = ${record.DISTRICT_ADMIN_ZONE}, ID ${record.FOREST_FILE_ID}`)
    }
  }
}

const updateUsage = async (data) => {
  for (var i = 0; i < data.length; i++) {
    const record = data[i]

    if (!isValidRecord(record) || !record.CALENDAR_YEAR) {
      console.log(`Skipping record with ID ${record.FOREST_FILE_ID}, Year = ${record.CALENDAR_YEAR}`)
      continue
    }

    try {
      const agreement = await Agreement.findOne(db, {
        forest_file_id: record.FOREST_FILE_ID,
      });

      if (!agreement) {
        throw new Error(`No Agreement with ID ${record.FOREST_FILE_ID}`)
      }

      let usage = await Usage.findOne(db, {
        agreement_id: record.FOREST_FILE_ID,
        year: record.CALENDAR_YEAR,
      });

      if (!usage) {
        usage = await Usage.create(db, {
          year: parseInt(record.CALENDAR_YEAR),
          authorizedAum: parseInt(record.AUTHORIZED_USE) || 0,
          temporaryIncrease: parseInt(record.TEMP_INCREASE) || 0,
          totalNonUse: parseInt(record.TOTAL_NON_USE) || 0,
          totalAnnualUse: parseInt(record.TOTAL_ANNUAL_USE) || 0,
          agreement_id: agreement.forestFileId,
        })
      } else {
        usage = await Usage.update(db, 
          {
            id: usage.id,
          }, 
          {
            year: parseInt(record.CALENDAR_YEAR),
            authorizedAum: parseInt(record.AUTHORIZED_USE) || 0,
            temporaryIncrease: parseInt(record.TEMP_INCREASE) || 0,
            totalNonUse: parseInt(record.TOTAL_NON_USE) || 0,
            totalAnnualUse: parseInt(record.TOTAL_ANNUAL_USE) || 0,
            agreement_id: agreement.forestFileId,
          }
        );
      }

      console.log(`Imported Usage year = ${usage.year}, for Agreement ID = ${agreement.id}`)
    } catch (error) {
      console.log(`Can not update Usage. Error = ${error.message}`)
    }
  }
}

const updateClient = async data => {
  for (var i = 0; i < data.length; i++) {
    const record = data[i];

    if (!isValidRecord(record) || !record.CLIENT_LOCN_CODE) {
      console.log(`Skipping record with ID ${record.CLIENT_NUMBER}, Agreement ID = ${record.FOREST_FILE_ID}`,
      );
      continue;
    }

    try {
      const ctype = await ClientType.findOne(db, {
        code: record.FOREST_FILE_CLIENT_TYPE_CODE,
      });

      let client = await Client.findOne(db, {
        client_number: record.CLIENT_NUMBER,
      });

      if (!client) {
        client = await Client.create(db, {
          clientNumber: record.CLIENT_NUMBER,
          name: record.CLIENT_NAME || 'Unknown Name',
          locationCode: record.CLIENT_LOCN_CODE,
          startDate: record.LICENSEE_START_DATE ? parseDate(record.LICENSEE_START_DATE) : null,
        });
        const agreement = await Agreement.findById(db, record.FOREST_FILE_ID);
        if (agreement) {
          const query = `INSERT INTO client_agreement (agreement_id, client_id, client_type_id)
          VALUES ('${agreement.id}', '${client.id}', '${ctype.id}')`;

          await db.schema.raw(query);
        }
      } else {
        // TODO: need to know what's gonna change for client
        client = await Client.update(db, { client_number: record.CLIENT_NUMBER }, 
          {
            name: record.CLIENT_NAME || 'Unknown Name',
            locationCode: record.CLIENT_LOCN_CODE,
            startDate: record.LICENSEE_START_DATE ? parseDate(record.LICENSEE_START_DATE) : null,
          }
        );
        const agreement = await Agreement.findById(db, record.FOREST_FILE_ID);
        if (agreement) {
          const query = `UPDATE client_agreement SET client_type_id = '${ctype.id}'
          WHERE agreement_id = '${agreement.id}' AND client_id = '${client.id}'`;

          await db.schema.raw(query);
        }
      }

      console.log(`Imported Client ID = ${client.id}, Agreement ID = ${record.FOREST_FILE_ID}`);
    } catch (error) {
      console.log(record);
      console.log(`Can not update Client. Error = ${error.message}`);
    }
  }
};

const updateUser = async data => {
  for (var i = 0; i < data.length; i++) {
    const record = data[i]
    if (!record.CONTACT_USER_ID || !record.RANGE_ZONE_CODE) {
      console.log(`Skipping record with CODE ${record.RANGE_ZONE_CODE}, username = ${record.CONTACT_USER_ID}`)
      continue
    }

    try {
      let user = await User.findOne(db, {
        username: record.CONTACT_USER_ID.toLowerCase(),
      });

      const [first, last] = record.CONTACT.split(' ');

      if (!user) {
        user = await User.create(db, {
          username: record.CONTACT_USER_ID.toLowerCase(),
          givenName: first || 'Unknown',
          familyName: last || 'Unknown',
          email: `${first.toLowerCase()}.${last.toLowerCase()}@gov.bc.ca`,
        });
        await Zone.update(db, { code: record.RANGE_ZONE_CODE }, {
          user_id: user.id
        });
      } else {
        user = await User.update(db, { username: record.CONTACT_USER_ID.toLowerCase() }, {
          username: record.CONTACT_USER_ID.toLowerCase(),
          givenName: first || 'Unknown',
          familyName: last || 'Unknown',
          email: `${first.toLowerCase()}.${last.toLowerCase()}@gov.bc.ca`,
        });
        await Zone.update(db, { code: record.RANGE_ZONE_CODE }, {
          user_id: user.id
        });
      }

      console.log(`Imported User ID = ${user.id}, username  = ${user.username} and updated Zone ${record.RANGE_ZONE_CODE} owner.`);
    } catch (error) {
      console.log(`Can not update User with username ${record.CONTACT_USER_ID}. error = ${error.message}`);
    }
  }
}

const main = async () => {
  try {
    const licensee = await loadFile(LICENSEE);
    await updateDistrict(licensee)
    await updateZone(licensee)
    await updateAgreement(licensee)
    // {
    //   FOREST_FILE_ID: 'RAN075974',
    //   FILE_STATUS_ST: 'A',
    //   FILE_TYPE_CODE: 'E01',
    //   FILE_TYPE_DESC: 'Grazing Licence',
    //   ORG_UNIT_CODE: 'DPC',
    //   DISTRICT_ADMIN_ZONE: 'SPC',
    //   ZONE_DESCRIPTION: 'South Peace',
    //   CONTACT: 'Marika Cameron',
    //   CONTACT_PHONE_NUMBER: '',
    //   CONTACT_EMAIL_ADDRESS: '',
    //   LEGAL_EFFECTIVE_DT: '1/1/14',
    //   INITIAL_EXPIRY_DT: '12/31/23'
    // }

    const usage = await loadFile(USAGE); 
    await updateUsage(usage)
    // {
    //   FOREST_FILE_ID: 'RAN072542',
    //   CALENDAR_YEAR: '1995',
    //   AUTHORIZED_USE: '6',
    //   NON_USE_NONBILLABLE: '0',
    //   NON_USE_BILLABLE: '0',
    //   TOTAL_NON_USE: '0',
    //   TEMP_INCREASE: '0',
    //   TOTAL_ANNUAL_USE: '6'
    // }

    const client = await loadFile(CLIENT); 
    await updateClient(client);
    // {
    //   FOREST_FILE_ID: 'RAN077194',
    //   CLIENT_NUMBER: '00001023',
    //   CLIENT_LOCN_CODE: '00',
    //   CLIENT_NAME: 'MARTIN, WALTER EUGENE',
    //   FOREST_FILE_CLIENT_TYPE_CODE: 'A',
    //   LICENSEE_START_DATE: '2009-02-06 00:00:00'
    // }

    const user = await loadFile(USER);
    await updateUser(user);
    // { 
    // ADMIN_FOREST_DISTRICT_NO: '15',
    // RANGE_ZONE_CODE: 'CHWK',
    // ZONE_DESCRIPTION: 'Chilliwack',
    // CONTACT_USER_ID: 'RPARRIAD' 
    // CONTACT: 'Rene Phillips' 
    // }

    process.exit(0);
  } catch (err) {
    console.log(`Error importing data, message = ${err.message}`)
  }
}

main()