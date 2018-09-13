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

import csv from 'csv';
import fs from 'fs';
import request from 'request-promise-native';
import config from '../server/config';
import DataManager from '../server/libs/db2';

const USAGE = 'fta/FTA_RANGE_USAGE.csv';
const LICENSEE = 'fta/FTA_RANGE_LICENSEE.csv';
const CLIENT = 'fta/FTA_RANGE_CLIENT.csv';
const USER = 'fta/ZONE_USER.csv';
const LICENSEE_URL = 'http://nrc1db01.bcgov:8080/ords/the/FTA/GetAllRangeLicensees';
const USAGE_URL = 'http://nrc1db01.bcgov:8080/ords/the/FTA/GetAllRangeUsages';
const CLIENT_URL = 'http://nrc1db01.bcgov:8080/ords/the/FTA/GetAllRangeClients';

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
  if (!/^RAN\d{6}$/.test(record.forest_file_id)) {
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
          const key = value.replace(/ /g, '_').toLowerCase();
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

const loadDataFromUrl = async (url) => {
    const options = {
      headers: { 'content-type': 'application/json' },
      method: 'GET',
      uri: url,
      json: true,
    };

    const response = await request(options);

    return response.items;
};

const updateAgreement = async (data) => {

  for (var i = 0; i < data.length; i++) {
    const record = data[i]
    if (!isValidRecord(record) || !record.district_admin_zone || !record.file_type_code) {
      console.log(`Skipping record with ID ${record.forest_file_id}`);
      continue
    }

    try {
      const zone = await Zone.findOne(db, {
        code: record.district_admin_zone
      });

      if (!zone) {
        throw new Error(`No zone with code ${record.district_admin_zone || 'NULL'}`)
      }

      const atype = await AgreementType.findOne(db, {
        code: record.file_type_code
      });

      if (!atype) {
        throw new Error(`No AgreementType with code ${record.file_type_code || 'NULL'}`)
      }

      const exemption = await AgreementExemptionStatus.findOne(db, { code: 'N' }); // Not Exempt

      const agreement = await Agreement.findById(db, record.forest_file_id);
      if (!agreement) {
        await Agreement.create(db, {
          forestFileId: record.forest_file_id,
          agreementStartDate: new Date(record.legal_effective_dt), // Short Format
          agreementEndDate: new Date(record.initial_expiry_dt), // Short Format
          zoneId: zone.id,
          agreementTypeId: atype.id,
          agreementExemptionStatusId: exemption.id,
        });
      } else {
        await Agreement.update(db, 
          {
            forest_file_id: record.forest_file_id,
          }, 
          {
            agreementStartDate: new Date(record.legal_effective_dt), // Short Format
            agreementEndDate: new Date(record.initial_expiry_dt), // Short Format
            zoneId: zone.id,
            agreementTypeId: atype.id,
            agreementExemptionStatusId: exemption.id,
          }
        );
      }

      // console.log(`Processed Agreement with ID ${record.forest_file_id}`)
    } catch (error) {
      console.log(`Error with message = ${error.message}, ID ${record.forest_file_id}`)
    }
  }
}

const updateDistrict = async (data) => {
  for (var i = 0; i < data.length; i++) {
    const record = data[i]

    if (!isValidRecord(record) || !record.org_unit_code) {
      console.log(`Skipping record with ID ${record.forest_file_id}`)
      continue
    }

    try {
      let district = await District.findOne(db,
        {
          code: record.org_unit_code
        }
      );

      if (!district) {
        console.log(`Adding District with ID ${record.org_unit_code}`)
        district = await District.create(db, {
          code: record.org_unit_code,
          description: 'No description available',
        })

        // continue
      }

      // district.description = record.XXXXXX || 'No District Description'
    } catch (error) {
      console.log(`Error with message = ${error.message}, District ID ${record.org_unit_code}`)
    }
  }
}

const updateZone = async (data) => {
  for (var i = 0; i < data.length; i++) {
    const record = data[i]

    if (!isValidRecord(record) || !record.district_admin_zone) {
      console.log(`Skipping record with ID ${record.forest_file_id}`)
      continue
    }

    try {
      let zone
      zone = await Zone.findOne(db, {
        code: record.district_admin_zone
      });

      if (!zone) {
        const district = await District.findOne(db, {
          code: record.org_unit_code
        })

        if (!district) {
          throw new Error(`No District with ID ${record.org_unit_code}`)
        }

        zone = await Zone.create(db, {
          code: record.district_admin_zone,
          description: record.zone_description || 'No description available',
          districtId: district.id,
        })
      }

      // console.log(`Processed Zone with code = ${zone.code}, id = ${zone.id}`)
    } catch (error) {
      console.log(`Can not update Zone. Error = ${error.message}, Zone = ${record.district_admin_zone}, ID ${record.forest_file_id}`)
    }
  }
}

const updateUsage = async (data) => {
  for (var i = 0; i < data.length; i++) {
    const record = data[i]

    if (!isValidRecord(record) || !record.calendar_year) {
      console.log(`Skipping record with ID ${record.forest_file_id}, Year = ${record.calendar_year}`)
      continue
    }

    try {
      const agreement = await Agreement.findOne(db, {
        forest_file_id: record.forest_file_id,
      });

      if (!agreement) {
        throw new Error(`No Agreement with ID ${record.forest_file_id}`)
      }

      let usage = await Usage.findOne(db, {
        agreement_id: record.forest_file_id,
        year: record.calendar_year,
      });

      if (!usage) {
        usage = await Usage.create(db, {
          year: Number(record.calendar_year),
          authorizedAum: Number(record.authorized_use) || 999,
          temporaryIncrease: Number(record.temp_increase) || 0,
          totalNonUse: Number(record.total_non_use) || 0,
          totalAnnualUse: Number(record.total_annual_use) || 0,
          agreementId: agreement.forestFileId,
        })
      } else {
        usage = await Usage.update(db, 
          {
            id: usage.id,
          }, 
          {
            year: Number(record.calendar_year),
            authorizedAum: Number(record.authorized_use) || 0,
            temporaryIncrease: Number(record.temp_increase) || 0,
            totalNonUse: Number(record.total_non_use) || 0,
            totalAnnualUse: Number(record.total_annual_use) || 0,
            agreementId: agreement.forestFileId,
          }
        );
      }

      // console.log(`Imported Usage year = ${usage.year}, for Agreement ID = ${agreement.id}`)
    } catch (error) {
      console.log(`Can not update Usage. Error = ${error.message}`)
    }
  }
}

const updateClient = async data => {
  for (var i = 0; i < data.length; i++) {
    const record = data[i];

    if (!isValidRecord(record) || !record.client_locn_code) {
      console.log(`Skipping record with ID ${record.client_number}, Agreement ID = ${record.forest_file_id}`,
      );
      continue;
    }

    try {
      const ctype = await ClientType.findOne(db, {
        code: record.forest_file_client_type_code,
      });

      let client = await Client.findOne(db, {
        client_number: record.client_number,
      });

      if (!client) {
        client = await Client.create(db, {
          clientNumber: record.client_number,
          name: record.client_name || 'Unknown Name',
          locationCode: record.client_locn_code,
          startDate: record.licensee_start_date ? parseDate(record.licensee_start_date) : null,
        });
        // const agreement = await Agreement.findById(db, record.forest_file_id);
        // if (agreement) {
        //   const query = `INSERT INTO client_agreement (agreement_id, client_id, client_type_id)
        //   VALUES ('${agreement.id}', '${client.id}', '${ctype.id}')`;

        //   await db.schema.raw(query);
        // }
      } else {
        // TODO: need to know what's gonna change for client
        client = await Client.update(db, { client_number: record.client_number }, 
          {
            name: record.client_name || 'Unknown Name',
            locationCode: record.client_locn_code,
            startDate: record.licensee_start_date ? parseDate(record.licensee_start_date) : null,
          }
        );
        // const agreement = await Agreement.findById(db, record.forest_file_id);
        // if (agreement) {
        //   const query = `UPDATE client_agreement SET client_type_id = '${ctype.id}'
        //   WHERE agreement_id = '${agreement.id}' AND client_id = '${client.id}'`;

        //   await db.schema.raw(query);
        // }
      }
      const agreement = await Agreement.findById(db, record.forest_file_id);
      if (agreement) {
        const query = `INSERT INTO client_agreement (agreement_id, client_id, client_type_id)
        VALUES ('${agreement.id}', '${client.id}', '${ctype.id}')`;

        await db.schema.raw(query);
      }
      // console.log(`Imported Client ID = ${client.id}, Agreement ID = ${record.forest_file_id}`);
    } catch (error) {
      console.log(record);
      console.log(`Can not update Client. Error = ${error.message}`);
    }
  }
};

const updateUser = async data => {
  for (var i = 0; i < data.length; i++) {
    const record = data[i]
    const username = record.idir;
    const zoneCode = record.range_zone_code;
    if (!username || !zoneCode) {
      console.log(`Skipping record with CODE ${zoneCode}, username = ${username} row = ${i}`);
      continue
    }
    
    try {
      // old csv file
      // const username = record.contact_user_id.toLowerCase();
      // const [first, last] = record.contact.split(' ');
      // const email = `${first.toLowerCase()}.${last.toLowerCase()}@gov.bc.ca`;
      // const zoneCode = record.range_zone_code;
      // const phoneNumber = record.telephone_number;
      
      const username = record.idir.trim();
      const first = record.first_name.trim() || 'Unknown';
      const last = record.last_name.trim() || 'Unknown';
      const email = record.email.trim();
      const zoneCode = record.range_zone_code.trim();
      const phoneNumber = record.telephone_number.trim();

      let user = await User.findOne(db, {
        username,
      });

      if (!user) {
        user = await User.create(db, {
          username,
          givenName: first,
          familyName: last,
          email,
          active: true,
          phoneNumber,
        });
      } else {
        await User.update(db, { username }, {
          username,
          givenName: first,
          familyName: last,
          email,
          active: true,
          phoneNumber,
        });
      }
      
      if (await Zone.findOne(db, { code: zoneCode })) {
        await Zone.update(db, { code: zoneCode }, {
          user_id: user.id
        });
      } else {
        throw new Error(`Zone ${zoneCode} doesn't exist`)
      }

      console.log(`Imported User ID = ${user.id}, username  = ${user.username} and updated Zone ${zoneCode} owner.`);
    } catch (error) {
      console.log(`Can not update User with username ${username}. error = ${error.message}`);
    }
  }
}

const loadData = async (fromUrl) => {
  let licensee, usage, client, user;
  if (fromUrl) {
    licensee = await loadDataFromUrl(LICENSEE_URL);
    usage = await loadDataFromUrl(USAGE_URL);
    client = await loadDataFromUrl(CLIENT_URL);
  } else {
    licensee = await loadFile(LICENSEE);
    usage = await loadFile(USAGE);
    client = await loadFile(CLIENT);
    user = await loadFile(USER);
  }
  await updateDistrict(licensee)
  await updateZone(licensee)
  await updateAgreement(licensee)
  await updateUsage(usage)
  await updateUser(user);
  await updateClient(client);
};

const main = async () => {
  try {
    const isFromAPI = false;
    await loadData(isFromAPI);
    // {
    //   forest_file_id: 'RAN000133',
    //   file_status_st: 'A',
    //   file_type_code: 'E01',
    //   file_type_desc: 'Grazing Licence',
    //   org_unit_code: 'DPC',
    //   district_admin_zone: 'SPC',
    //   zone_description: 'South Peace',
    //   contact: 'Marika Cameron',
    //   contact_phone_number: '',
    //   contact_email_address: '',
    //   legal_effective_dt: '1/1/14',
    //   initial_expiry_dt: '12/31/23'
    // }

    // {         
    //  "non_use_billable" : 0,
    //  "temp_increase" : 0,
    //  "calendar_year" : 1992,
    //  "non_use_nonbillable" : 0,
    //  "total_annual_use" : 550,
    //  "forest_file_id" : "RAN000133",
    //  "authorized_use" : 550
    // }
    // MISSING: TOTAL_NON_USE

    // {
    //  "forest_file_id" : "RAN000133",
    //  "licensee_end_date" : null,
    //  "client_number" : "00002544",
    //  "licensee_start_date" : null,
    //  "forest_file_client_type_code" : "A",
    //  "client_name" : "FOO, BARR Jannah",
    //  "client_locn_code" : "00"
    // }

    // { 
    // ADMIN_FOREST_DISTRICT_NO: '15',
    // range_zone_code: 'CHWK',
    // ZONE_DESCRIPTION: 'Chilliwack',
    // contact_user_id: 'RPARRIAD' 
    // CONTACT: 'Rene Phillips' 
    // }

    process.exit(0);
  } catch (err) {
    console.log(`Error importing data, message = ${err.message}`)
  }
}

main()