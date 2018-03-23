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
import DataManager from '../server/libs/db'
import config from '../server/config'

const USAGE = 'FTA/FTA_RANGE_USAGE.csv'
const LICENSEE = 'FTA/FTA_RANGE_LICENSEE.csv'

const dm = new DataManager(config);
const {
  Agreement,
  AgreementType,
  AgreementExemptionStatus,
  // PlanStatus,
  // Client,
  // ClientType,
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

const loadFile = (name) => new Promise((resolve, reject) => {
  const records = [];
  fs.readFile(name, 'utf8', (err, contents) => {
    const parser = csv.parse(contents, (err, data) => {
      if (err) reject(err)

      const fields = data.shift()
      fields.pop();
      data.forEach((line) => {
        const record = {}
        fields.forEach((value, i) => {
          if (i > 1) {
            record[value] = line[i]
            return
          }

          record[value] = line[i]
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
      const zone = await Zone.findOne({
        where: {
          code: record.DISTRICT_ADMIN_ZONE
        }
      })

      if (!zone) {
        throw new Error(`No zone with code ${record.DISTRICT_ADMIN_ZONE || 'NULL'}`)
      }

      const atype = await AgreementType.findOne({
        where: {
          code: record.FILE_TYPE_CODE
        }
      })

      if (!atype) {
        throw new Error(`No AgreementType with code ${record.FILE_TYPE_CODE || 'NULL'}`)
      }

      const exemption = await AgreementExemptionStatus.findById(1); // Default

      await Agreement.upsert({
        id: record.FOREST_FILE_ID,
        agreementStartDate: new Date(record.LEGAL_EFFECTIVE_DT), // Short Format
        agreementEndDate: new Date(record.INITIAL_EXPIRY_DT), // Short Format
        zoneId: zone.id,
        typeId: atype.id,
        exemptionStatusId: exemption.id,
      })

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
      let district = await District.findOne({
        where: {
          code: record.ORG_UNIT_CODE
        }
      })

      if (!district) {
        console.log(`Adding District with ID ${record.ORG_UNIT_CODE}`)
        district = await District.create({
          code: record.ORG_UNIT_CODE,
          description: 'No description available',
        })

        // continue
      }

      // district.description = record.XXXXXX || 'No District Description'
      // await district.save()
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
      zone = await Zone.findOne({
        where: {
          code: record.DISTRICT_ADMIN_ZONE
        }
      })

      if (!zone) {
        const district = await District.findOne({
          where: {
            code: record.ORG_UNIT_CODE
          }
        })

        if (!district) {
          throw new Error(`No District with ID ${record.ORG_UNIT_CODE}`)
        }

        zone = await Zone.create({
          code: record.DISTRICT_ADMIN_ZONE,
          description: record.ZONE_DESCRIPTION || 'No description available',
          districtId: district.id,
        })
      }

      zone.contactName = zone.contactName ? zone.contactName : (record.CONTACT || null)
      zone.contactPhoneNumber = zone.contactPhoneNumber ? zone.contactPhoneNumber : (record.CONTACT_PHONE_NUMBER || null)
      zone.contactEmail = zone.contactEmail ? zone.contactEmail : (record.CONTACT_EMAIL_ADDRESS || null)

      await zone.save()

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
      const agreement = await Agreement.findOne({
        where: {
          id: record.FOREST_FILE_ID,
        }
      })

      if (!agreement) {
        throw new Error(`No Agreement with ID ${record.FOREST_FILE_ID}`)
      }

      let usage = await Usage.findOne({
        where: {
          agreementId: record.FOREST_FILE_ID,
          year: record.CALENDAR_YEAR,
        }
      })

      if (!usage) {
        usage = await Usage.create({
          year: record.CALENDAR_YEAR,
          authorizedAum: parseInt(record.AUTHORIZED_USE) || 0,
          temporaryIncrease: parseInt(record.TEMP_INCREASE) || 0,
          totalNonUse: parseInt(record.TOTAL_NON_USE) || 0,
          totalAnnualUse: parseInt(record.TOTAL_ANNUAL_USE) || 0,
          agreementId: agreement.id,
        })
      }

      usage.authorizedAum = parseInt(record.AUTHORIZED_USE) || 0
      usage.temporaryIncrease = parseInt(record.TEMP_INCREASE) || 0
      usage.totalNonUse = parseInt(record.TOTAL_NON_USE) || 0
      usage.totalAnnualUse = parseInt(record.TOTAL_ANNUAL_USE) || 0

      await usage.save()

      console.log(`Imported Usage year = ${usage.year}, for Agreement ID = ${agreement.id}`)
    } catch (error) {
      console.log(`Can not update Usage. Error = ${error.message}`)
    }
  }
}

const main = async () => {
  try {
    const licensee = await loadFile(LICENSEE);
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
    await updateDistrict(licensee)
    await updateZone(licensee)
    await updateAgreement(licensee)

    const usage = await loadFile(USAGE); 
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
    await updateUsage(usage)

    process.exit(0);
  } catch (err) {
    console.log(`Error importing data, message = ${err.message}`)
  }
}

main()