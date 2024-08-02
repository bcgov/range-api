'use strict';

import request from 'request-promise-native';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const LICENSEE_URL = `${process.env.FTA_BASE_URL}/ords-myra/v1/fta/FTA/GetAllRangeLicensees`;
const TOKEN_URL = `${process.env.FTA_BASE_URL}/ords-myra/v1/fta/oauth/token?grant_type=client_credentials`;

const getFTAToken = async (url) => {
  const options = {
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    url,
    json: true,
    auth: {
      username: process.env.FTA_API_STORE_USERNAME,
      password: process.env.FTA_API_STORE_PASSWORD,
    },
  };

  const response = await request(options);

  return response;
};

const loadDataFromUrl = async (token, url) => {
  const options = {
    headers: { 'content-type': 'application/json', Authorization: token },
    method: 'GET',
    uri: url,
    json: true,
  };

  const response = await request(options);

  return response.items;
};

const isValidRecord = (record) => {
  if (!/^RAN\d{6}$/.test(record.forest_file_id)) {
    return false;
  }

  return true;
};

const countAgreements = (data) => {
  let number = 0;

  // a map whose property is 'district code' and value is 'array of agreement ids'
  let map = {};

  data.forEach((record) => {
    const {
      forest_file_id: agreementId,
      district_admin_zone: zoneCode,
      org_unit_code: districtCode,
      zone_description: zoneDescription,
      contact_email_address: staffEmail,
    } = record;

    if (!isValidRecord(record)) {
      return;
    }

    try {
      if (!staffEmail && districtCode) {
        number += 1;

        if (!map[districtCode]) {
          map = {
            ...map,
            // create an initial array for this particular district
            [districtCode]: [agreementId],
          };
        } else {
          map = {
            ...map,
            // keep adding new element in the existing array
            [districtCode]: [...map[districtCode], agreementId],
          };
        }
      }
    } catch (error) {
      throw error;
    }
  });

  // console.log(map);
  console.log(`The number of agreements without the contact email: ${number}`);
  fs.writeFile(
    './scripts/agreementsMissingContactEmail.json',
    JSON.stringify(map),
    'utf8',
    (err) => {
      if (err) {
        return console.log(err);
      }

      console.log('The file was saved!');
    },
  );
};

const main = async () => {
  try {
    const res = await getFTAToken(TOKEN_URL);
    const { access_token, token_type } = res;
    const token = `${token_type} ${access_token}`;
    const licensee = await loadDataFromUrl(token, LICENSEE_URL);

    countAgreements(licensee);
  } catch (err) {
    console.log(`Error occur!, message = ${err.message}`);
    throw err;
  }
};

main();
