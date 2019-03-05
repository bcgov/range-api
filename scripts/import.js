'use strict';

import csv from 'csv';
import fs from 'fs';
import request from 'request-promise-native';
import config from '../src/config';
import DataManager from '../src/libs/db2';
import * as mockData from './mockData';

const USAGE = 'fta/FTA_RANGE_USAGE.csv';
const LICENSEE = 'fta/FTA_RANGE_LICENSEE.csv';
const CLIENT = 'fta/FTA_RANGE_CLIENT.csv';
const USER = 'fta/ZONE_USER.csv';
const LICENSEE_URL = `${process.env.FTA_BASE_URL}/ords/v1/fta/FTA/GetAllRangeLicensees`;
const USAGE_URL = `${process.env.FTA_BASE_URL}/ords/v1/fta/FTA/GetAllRangeUsages`;
const CLIENT_URL = `${process.env.FTA_BASE_URL}/ords/v1/fta/FTA/GetAllRangeClients`;
const TOKEN_URL = `${process.env.FTA_BASE_URL}/ords/v1/fta/oauth/token?grant_type=client_credentials`;

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

const skipping = (action, agreementId, index) => {
  if (agreementId.indexOf('RB') >= 0 || agreementId.indexOf('DL') >= 0) return;
  console.log(`Skipping Record with aId: ${agreementId}, row: ${index + 2}, when: ${action}`);
};

const updateDistrict = async (data) => {
  let created = 0;
  console.log('Start updating District');
  for (let index = 0; index < data.length; index++) {
    const record = data[index];    
    const { forest_file_id: agreementId, org_unit_code: districtCode } = record;

    if (!isValidRecord(record) || !districtCode) {
      skipping('Updating district', agreementId, index);
      continue;
    }

    const district = await District.findOne(db, { code: districtCode });
    if (district) continue;

    try {
      console.log(`Adding District with Code ${districtCode}`)
      await District.create(db, {
        code: districtCode,
        description: 'No description available',
      });
      created += 1;
    } catch (error) {
      console.log(`Error with message = ${error.message}, District Code ${districtCode} row: ${index + 2}`)
      throw error;
    }
  }

  return `${created} districts were created.`;
};

const updateZone = async (data) => {
  const districts = await District.find(db, {});
  const districtCodesMap = {};
  districts.map(d => {
    districtCodesMap[d.code] = d;
  });
  let created = 0;
  console.log('Start updating Zones');

  for (let index = 0; index < data.length; index++) {
    const record = data[index];
    const {
      forest_file_id: agreementId,
      district_admin_zone: zoneCode,
      org_unit_code: districtCode,
      zone_description: zoneDescription,
      contact_email_address: staffEmail,
    } = record;
    if (!isValidRecord(record) || !zoneCode) {
      skipping('Updating Zone', agreementId, index);
      continue;
    }

    const district = districtCodesMap[districtCode];
    if (!district) {
      console.log(`No District with Code ${districtCode}`);
      continue;
    }

    try {
      const staff = staffEmail ? await User.findOne(db, { email: staffEmail }) : null;
      const zone = await Zone.findOne(db, { code: zoneCode, district_id: district.id });

      if (!zone) {        
        console.log(`Adding Zone with Code ${zoneCode} District Code: ${districtCode}`)
        await Zone.create(db, {
          code: zoneCode,
          description: zoneDescription || 'No description available',
          district_id: district.id,
          userId: staff && staff.id,
        });
        created += 1;
      } else {
        const data = {
          description: zoneDescription || 'No description available',
        };
        if (staff) data.userId = staff.id;

        await Zone.update(db, {
          code: zoneCode,
          district_id: district.id,
        }, data);
      }
    } catch (error) {
      console.log(`Error with message = ${error.message}, Zone Code ${zoneCode} row: ${index + 2}`)
      throw error;
    }
  }

  return `${created} zones were created`;
};

const updateUser = async (data) => {
  let created = 0;
  let updated = 0;
  let zoneUpdated = 0;
  const districts = await District.find(db, {});
  const districtCodesMap = {};
  districts.map(d => {
    districtCodesMap[d.code] = d;
  });
  const zones = await Zone.find(db, {});
  
  console.log('Start updating Users');
  for (let index = 0; index < data.length; index++) {
    const record = data[index];
    const {
      idir,
      range_zone_code,
      range_zone_full,
      first_name,
      last_name,
      email: rawEmail,
      telephone_number,
      district: districtCode,
    } = record;

    if (!idir) {
      console.log(`Skipping Record with this user record row: ${index + 2}`);
      continue;
    }

    const username = `idir\\${idir.toLowerCase().trim()}`;
    const first = first_name.trim() || 'Unknown';
    const last = last_name.trim() || 'Unknown';
    const email = rawEmail.toLowerCase().trim();
    const zoneCode = range_zone_code && range_zone_code.trim();
    const phoneNumber = telephone_number.trim();
    const zoneDescription = range_zone_full ? range_zone_full.trim() : 'No description available';

    try {
      let user = await User.findOne(db, {
        username,
      });

      if (user) {
        await User.update(db, { username }, {
          username,
          givenName: first,
          familyName: last,
          email,
          active: true,
          phoneNumber,
        });
        updated += 1;
      } else {
        user = await User.create(db, {
          username,
          givenName: first,
          familyName: last,
          email,
          active: true,
          phoneNumber,
        });
        created += 1;
      }
      const district = districtCodesMap[districtCode];
      const zone = zones.find(zone => {
        const { code, districtId } = zone;
        return (code === zoneCode && districtId === district.id);
      });

      if (zone) {
        await Zone.update(db, { id: zone.id }, {
          user_id: user.id,
          description: zoneDescription,
        });
        zoneUpdated += 1;
      }

    } catch (error) {
      console.log(`Error with message = ${error.message}, username ${username} row: ${index + 2}`)
      throw error;
    }
  }

  return `${created} users were created, ${updated} users were updated, ${zoneUpdated} zones were updated`;
};

const updateAgreement = async (data) => {
  console.log('Start updating Agreements');
  const districts = await District.find(db, {});
  const districtCodesMap = {};
  districts.map(d => {
    districtCodesMap[d.code] = d;
  });
  const zones = await Zone.find(db, {});
  const agreementTypes = await AgreementType.find(db, {});
  const agreementTypesMap = {};
  agreementTypes.map(at => {
    agreementTypesMap[at.code] = at;
  });
  const exemption = await AgreementExemptionStatus.findOne(db, { code: 'N' }); // Not Exempt

  let created = 0;
  let updated = 0;
  for (let index = 0; index < data.length; index++) {
    const record = data[index];
    const {
      forest_file_id: agreementId,
      district_admin_zone: zoneCode,
      org_unit_code: districtCode,
      file_type_code: agreementTypeCode,
      legal_effective_dt,
      initial_expiry_dt,
    } = record;

    if (!isValidRecord(record) || !agreementTypeCode || !zoneCode || !districtCode) {
      skipping('Updating Agreement', agreementId, index);
      continue;
    }
    const district = districtCodesMap[districtCode];
    const zone = zones.find(zone => {
      const { code, districtId } = zone;
      return (code === zoneCode && districtId === district.id);
    });
    if (!zone) {
      console.log(`No zone with code ${zoneCode}`);
      continue;
    }
    const agreementType = agreementTypesMap[agreementTypeCode];
    if (!agreementType) {
      console.log(`No AgreementType with code ${agreementTypeCode}`);
      continue;
    }
    try {
      const agreement = await Agreement.findById(db, agreementId);
      if (agreement) {
        await Agreement.update(db, { forest_file_id: agreementId }, 
          {
            agreementStartDate: new Date(legal_effective_dt), // Short Format
            agreementEndDate: new Date(initial_expiry_dt), // Short Format
            zoneId: zone.id,
            agreementTypeId: agreementType.id,
            agreementExemptionStatusId: exemption.id,
          }
        );
        updated += 1;
      } else {
        await Agreement.create(db, {
          forestFileId: agreementId,
          agreementStartDate: new Date(legal_effective_dt), // Short Format
          agreementEndDate: new Date(initial_expiry_dt), // Short Format
          zoneId: zone.id,
          agreementTypeId: agreementType.id,
          agreementExemptionStatusId: exemption.id,
        });
        created += 1;
      }
    } catch (error) {
      console.log(`Error with message = ${error.message}, aId ${agreementId} row: ${index + 2}`)
      throw error;
    }
  }
  
  return `${created} agreements were created. ${updated} agreements were updated`;
};

const updateUsage = async (data) => {
  let created = 0;
  let updated = 0;
  console.log('Start updating Usage');
  
  for (let index = 0; index < data.length; index++) {
    const record = data[index];
    const {
      forest_file_id: agreementId,
      calendar_year,
      authorized_use,
      temp_increase,
      total_non_use,
      total_annual_use,
    } = record;
    if (!isValidRecord(record) || !calendar_year) {
      skipping('Updating Usage', agreementId, index);
      continue;
    }

    try {
      const agreement = await Agreement.findOne(db, {
        forest_file_id: agreementId,
      });
      if (!agreement) {
        console.log(`No Agreement with ID ${agreementId}`);
        continue;
      }

      const usage = await Usage.findOne(db, {
        agreement_id: agreementId,
        year: calendar_year,
      });

      if (usage) {
        await Usage.update(db, { id: usage.id }, 
          {
            year: Number(calendar_year),
            authorizedAum: Number(authorized_use) || 0,
            temporaryIncrease: Number(temp_increase) || 0,
            totalNonUse: Number(total_non_use) || 0,
            totalAnnualUse: Number(total_annual_use) || 0,
            agreementId: agreement.forestFileId,
          }
        );
        updated += 1;
      } else {
        await Usage.create(db, {
          year: Number(calendar_year),
          authorizedAum: Number(authorized_use) || 0,
          temporaryIncrease: Number(temp_increase) || 0,
          totalNonUse: Number(total_non_use) || 0,
          totalAnnualUse: Number(total_annual_use) || 0,
          agreementId: agreement.forestFileId,
        });
        created += 1;
      }
    } catch (error) {
      console.log(`Error with message = ${error.message}, usage year ${calendar_year} row: ${index + 2}`)
      throw error;
    }
  }

  return `${created} usage were created, ${updated} usage were updated`;
};

const updateClient = async (data) => {
  const clientTypes = await ClientType.find(db, {});
  let created = 0;
  let updated = 0;
  console.log('Start updating Clients');
  for (let index = 0; index < data.length; index++) {
    const record = data[index];
    const {
      forest_file_id: agreementId,
      client_locn_code: clientLocationCode,
      forest_file_client_type_code: clientTypeCode,
      client_number: clientNumber,
      client_name: clientName,
      licensee_start_date: licenseeStartDate,
    } = record;

    if (!isValidRecord(record) || !clientLocationCode) {
      skipping('Updating Client', agreementId, index);
      continue;
    }

    const clientType = clientTypes.find(ct => ct.code === clientTypeCode);
    if (!clientType) {
      console.log(`No client type with ID ${agreementId}`);
      continue;
    }

    try {
      let client = await Client.findOne(db, {
        client_number: clientNumber,
      });

      if (client) {
        await Client.update(db, { client_number: clientNumber }, 
          {
            name: clientName || 'Unknown Name',
            locationCode: clientLocationCode,
            startDate: licenseeStartDate ? parseDate(licenseeStartDate) : null,
          }
        );
        updated += 1;
      } else {
        client = await Client.create(db, {
          clientNumber: clientNumber,
          name: clientName || 'Unknown Name',
          locationCode: clientLocationCode,
          startDate: licenseeStartDate ? parseDate(licenseeStartDate) : null,
        });
        created += 1;
      }

      const agreement = await Agreement.findById(db, agreementId);
      const clientAgreement = await ClientAgreement.findOne(db, {
        agreement_id: agreementId,
        client_id: client.id
      });
      if (agreement && !clientAgreement) {
        await ClientAgreement.create(db, {
          agreement_id: agreementId,
          client_id: client.id,
          client_type_id: clientType.id,
        });
      }
    } catch (error) {
      console.log(`Error with message = ${error.message}, client number ${clientNumber} row: ${index + 2}`)
      throw error;
    }
  }
  
  return `${created} clients were created, ${updated} clients were updated`;
};

const prepareTestSetup = async () => {
  try {
    // create test data
    await updateAgreement(mockData.mockAgreements);
    await updateUsage(mockData.mockUsage);
    await updateClient(mockData.mockClients);

    // assign zones
    const lisa = await User.findOne(db, { username: 'idir\\lmoore' });
    await Zone.update(db, { code: 'TEST1' }, { user_id: lisa.id });
    await Zone.update(db, { code: 'TEST5' }, { user_id: lisa.id });
    const katie = await User.findOne(db, { username: 'idir\\kmenke' });
    await Zone.update(db, { code: 'TEST2' }, { user_id: katie.id });
    await Zone.update(db, { code: 'TEST4' }, { user_id: katie.id });
    const amir = await User.findOne(db, { username: 'idir\\ashayega' });
    await Zone.update(db, { code: 'TEST3' }, { user_id: amir.id });
    const rangeAppTester = await User.findOne(db, { username: 'bceid\\rangeapptester' });
    await Zone.update(db, { code: 'TEST6' }, { user_id: rangeAppTester.id });

    // assign clients
    const leslie = await User.findOne(db, { username: 'bceid\\leslie.knope' });
    await User.update(db, { id: leslie.id }, { client_id: mockData.leslie.client_number });
    const ron = await User.findOne(db, { username: 'bceid\\ron.swanson' });
    await User.update(db, { id: ron.id }, { client_id: mockData.ron.client_number });
    const tom = await User.findOne(db, { username: 'bceid\\tom.haverford'});
    await User.update(db, { id: tom.id }, { client_id: mockData.tom.client_number });
    const andy = await User.findOne(db, { username: 'bceid\\andy.dwyer'});
    await User.update(db, { id: andy.id }, { client_id: mockData.andy.client_number });
    const april = await User.findOne(db, { username: 'bceid\\april.ludgate'});
    await User.update(db, { id: april.id }, { client_id: mockData.april.client_number });
    const ann = await User.findOne(db, { username: 'bceid\\ann.perkins'});
    await User.update(db, { id: ann.id }, { client_id: mockData.ann.client_number });
    const ben = await User.findOne(db, { username: 'bceid\\ben.wyatt'});
    await User.update(db, { id: ben.id }, { client_id: mockData.ben.client_number });
    const chris = await User.findOne(db, { username: 'bceid\\chris.traeger'});
    await User.update(db, { id: chris.id }, { client_id: mockData.chris.client_number });
    const nackyu = await User.findOne(db, { username: 'bceid\\nackyu711' });
    await User.update(db, { id: nackyu.id }, { client_id: mockData.nackyu.client_number });

    console.log('Done preparing for test accounts');
    
  } catch (error) {
    console.log(`Error with message = ${error.message}`)
    throw error;
  }
};

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

const updateFTAData = async (licensee, client, usage) => {
  let msg = '';
  msg = msg + await updateDistrict(licensee) + '\n';
  msg = msg + await updateZone(licensee) + '\n';
  msg = msg + await updateAgreement(licensee) + '\n';
  msg = msg + await updateUsage(usage) + '\n';
  msg = msg + await updateClient(client);

  console.log(msg);
}

const loadFTADataFromCSV = async () => {
  const licensee = await loadFile(LICENSEE);
  const usage = await loadFile(USAGE);
  const client = await loadFile(CLIENT);

  await updateFTAData(licensee, client, usage);
};

const loadStaffDataFromCSV = async () => {
  const user = await loadFile(USER);
  const msg = await updateUser(user);
  console.log(msg);
};

const loadFTADataFromAPI = async () => {
  const res = await getFTAToken(TOKEN_URL);
  const {
    access_token,
    token_type,
    // expires_in,
  } = res;
  const token = `${token_type} ${access_token}`;
  
  const licensee = await loadDataFromUrl(token, LICENSEE_URL);
  const usage = await loadDataFromUrl(token, USAGE_URL);
  const client = await loadDataFromUrl(token, CLIENT_URL);

  await updateFTAData(licensee, client, usage);
};

const main = async () => {
  try {
    var args = process.argv.slice(2);
    var isInitializing = args[0] === 'true';

    if (isInitializing) {
      /* DROP DATABASE MYRA first, and have ZONE_USER.csv */
      await loadFTADataFromAPI();
      // await loadFTADataFromCSV();
      await loadStaffDataFromCSV();
      await prepareTestSetup();
    } else {
      await loadFTADataFromAPI();
    }
  } catch (err) {
    console.log(`Error importing data, message = ${err.message}`);
    process.exit(0);
    throw err;
  }
  process.exit(0);
}

main();