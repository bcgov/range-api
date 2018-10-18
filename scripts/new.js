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
  Client,
  ClientType,
  ClientAgreement,
  District,
  Usage,
  User,
  Zone,
} = dm;

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

const updateDistrict = async (data) => {
  const promises = data.map(async (record, index) => {
    const { forest_file_id: agreementId, org_unit_code: districtCode } = record;

    if (!isValidRecord(record) || !districtCode) {
      console.log(`Skipping record with agreement id: ${agreementId} row: ${index}`)
      return;
    }

    const district = await District.findOne(db, { code: districtCode });
    if (district) {
      return;
    }

    try {
      console.log(`Adding District with Code ${districtCode}`)
      await District.create(db, {
        code: districtCode,
        description: 'No description available',
      });
    } catch (error) {
      console.log(`Error with message = ${error.message}, District ID ${districtCode} row: ${index}`)
      throw error;
    }
  });

  await Promise.all(promises);
};

const updateZone = () => {};
const updateAgreement = () => {};
const updateUsage = () => {};
const updateClient = () => {};
const updateUser = () => {};

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
  await updateDistrict(licensee);
  await updateZone(licensee);
  await updateAgreement(licensee);
  await updateUsage(usage);
  await updateClient(client);
  await updateUser(user);
};

const main = async () => {
  try {
    const isFromAPI = false;
    await loadData(isFromAPI);

    process.exit(0);
  } catch (err) {
    console.log(`Error importing data, message = ${err.message}`);
    throw err;
  }
}

main();