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

const skipping = (action, agreementId, index) => {
  if (agreementId.indexOf('RB') >= 0 || agreementId.indexOf('DL') >= 0) return;
  console.log(`Skipping Record with aId: ${agreementId}, row: ${index + 2}, when: ${action}`);
};

const updateDistrict = async (data) => {
  let created = 0;
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
  console.log(`${created} districts were created.`);
};

const updateZone = async (data) => {
  const districts = await District.find(db, {});
  const districtCodesMap = {};
  districts.map(d => {
    districtCodesMap[d.code] = d;
  });
  let created = 0;
  for (let index = 0; index < data.length; index++) {
    const record = data[index];
    const {
      forest_file_id: agreementId,
      district_admin_zone: zoneCode,
      org_unit_code: districtCode,
      zone_description: zoneDescription,
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
      const zone = await Zone.findOne(db, { code: zoneCode, district_id: district.id });
      if (!zone) {
        console.log(`Adding Zone with Code ${zoneCode}`)
        await Zone.create(db, {
          code: zoneCode,
          description: zoneDescription || 'No description available',
          districtId: district.id,
        });
        created += 1;
      }
    } catch (error) {
      console.log(`Error with message = ${error.message}, Zone Code ${zoneCode} row: ${index + 2}`)
      throw error;
    }
  }
  console.log(`${created} zones were created.`);
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
  console.log(`${created} users were created, ${updated} users were updated, ${zoneUpdated} zones were updated`);
};

const updateAgreement = async (data) => {
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
  console.log(`${created} agreements were created. ${updated} agreements were updated`);
};

const updateUsage = async (data) => {
  let created = 0;
  let updated = 0;
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
  console.log(`${created} usage were created, ${updated} usage were updated`);
};

const updateClient = async (data) => {
  const clientTypes = await ClientType.find(db, {});
  let created = 0;
  let updated = 0;
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
      if (agreement) {
        const query = `INSERT INTO client_agreement (agreement_id, client_id, client_type_id)
        VALUES ('${agreement.id}', '${client.id}', '${clientType.id}')`;

        await db.schema.raw(query);
      }
    } catch (error) {
      console.log(`Error with message = ${error.message}, client number ${clientNumber} row: ${index + 2}`)
      throw error;
    }
  }
  console.log(`${created} clients were created, ${updated} clients were updated`);
};

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
  await updateUser(user);
  await updateAgreement(licensee);
  await updateUsage(usage);
  await updateClient(client);
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