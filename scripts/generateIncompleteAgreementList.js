'use strict';

import request from 'request-promise-native';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const LICENSEE_URL = `${process.env.FTA_BASE_URL}/ords/v1/fta/FTA/GetAllRangeLicensees`;
const TOKEN_URL = `${process.env.FTA_BASE_URL}/ords/v1/fta/oauth/token?grant_type=client_credentials`;

const getFTAToken = async (url) => {  
  const options = {
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    url,
    json: true,
    auth: {
      username: process.env.FTA_API_STORE_USERNAME,
      password: process.env.FTA_API_STORE_PASSWORD,
    }
  };

  const response = await request(options);

  return response;
};

const loadDataFromUrl = async (token, url) => {
  const options = {
    headers: { 'content-type': 'application/json', 'Authorization': token },
    method: 'GET',
    uri: url,
    json: true,
  };

  const response = await request(options);

  return response.items;
};

const isValidRecord = (record) => {
  if (!/^RAN\d{6}$/.test(record.forest_file_id)) {
    return false
  }

  return true
}

const parseDate = (dateAsString) => new Date(dateAsString.replace(/-/g, '/'));
const skipping = (action, agreementId, index) => {
  if (agreementId.indexOf('RB') >= 0 || agreementId.indexOf('DL') >= 0) return;
};

const countAgreements = (data) => {
  let number = 0;
  let districtMap = {};

  for (let index = 0; index < data.length; index++) {
    const record = data[index];
    const {
      forest_file_id: agreementId,
      district_admin_zone: zoneCode,
      org_unit_code: districtCode,
      zone_description: zoneDescription,
      contact_email_address: staffEmail,
    } = record;

    if (!isValidRecord(record)) {
      skipping('Updating Zone', agreementId, index);
      continue;
    }

    try {
      if (!staffEmail && districtCode) {
        number += 1;

        if (!districtMap[districtCode]) {
          districtMap = {
            ...districtMap,
            [districtCode]: [agreementId],
          }
        } else {
          districtMap = {
            ...districtMap,
            [districtCode]: [...districtMap[districtCode], agreementId],
          }
        }
      }
    } catch (error) {
      console.log(`Error with message = ${error.message}, Zone Code ${zoneCode} row: ${index + 2}`)
      throw error;
    }
  }

  // console.log(districtMap);
  console.log(`The number of agreements that are missing contact emails: ${number}`);
  fs.writeFile('./scripts/agreementsMissingContactEmail.json', JSON.stringify(districtMap), 'utf8', (err) => {
    if (err) {
      return console.log(err);
    }

    console.log("The file was saved!");
  });
};

const main = async () => {
  try {
    const res = await getFTAToken(TOKEN_URL);
    const { access_token, token_type } = res;
    const token = `${token_type} ${access_token}`;
    const licensee = await loadDataFromUrl(token, LICENSEE_URL);
  
    countAgreements(licensee);
  } catch (err) {
    console.log(`Error importing data, message = ${err.message}`);
    process.exit(0);
    throw err;
  }
};

main();