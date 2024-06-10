'use strict';

import csv from 'csv';
import fs from 'fs';
import request from 'request-promise-native';
import config from '../src/config';
import DataManager from '../src/libs/db2';
import * as mockData from './mockData';

const USAGE = 'scripts/fta/FTA_RANGE_USAGE.csv';
const LICENSEE = 'scripts/fta/FTA_RANGE_LICENSEE.csv';
const CLIENT = 'scripts/fta/FTA_RANGE_CLIENT.csv';
const USER = 'scripts/fta/ZONE_USER.csv';
const LICENSEE_URL = `${process.env.FTA_BASE_URL}/ords/v1/fta/FTA/GetAllRangeLicensees`;
const USAGE_URL = `${process.env.FTA_BASE_URL}/ords/v1/fta/FTA/GetAllRangeUsages`;
const CLIENT_URL = `${process.env.FTA_BASE_URL}/ords/v1/fta/FTA/GetAllRangeClients`;
const TOKEN_URL = `${process.env.FTA_BASE_URL}/ords/v1/fta/oauth/token?grant_type=client_credentials`;

const dm = new DataManager(config);

const {
  db,
  UserClientLink,
  Agreement,
  AgreementType,
  AgreementExemptionStatus,
  Client,
  ClientType,
  ClientAgreement,
  District,
  Plan,
  PlanConfirmation,
  Usage,
  User,
  Zone,
} = dm;

const isValidRecord = (record) => {
  if (!/^RAN\d{6}$/.test(record.forest_file_id)) {
    return false;
  }

  return true;
};

const parseDate = (dateAsString) => new Date(dateAsString.replace(/-/g, '/'));

const skipping = (action, agreementId, index) => {
  if (agreementId.indexOf('RB') >= 0 || agreementId.indexOf('DL') >= 0) return;
  console.log(
    `Skipping Record with aId: ${agreementId}, row: ${
      index + 2
    }, when: ${action}`,
  );
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
      console.log(`Adding District with Code ${districtCode}`);
      await District.create(db, {
        code: districtCode,
        description: 'No description available',
      });
      created += 1;
    } catch (error) {
      console.log(
        `Error with message = ${
          error.message
        }, District Code ${districtCode} row: ${index + 2}`,
      );
      throw error;
    }
  }

  return `${created} districts were created.`;
};

const updateZone = async (data) => {
  const districts = await District.find(db, {});
  const districtCodesMap = {};
  districts.map((d) => {
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
      contact_email_address,
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
      const staffEmail =
        contact_email_address && contact_email_address.toLowerCase().trim();
      const staff = staffEmail
        ? (
            await User.find(db, { email: staffEmail }, ['last_login_at', 'asc'])
          ).pop()
        : null;
      const zone = await Zone.findOne(db, {
        code: zoneCode,
        district_id: district.id,
      });

      if (!zone) {
        console.log(
          `Adding Zone with Code ${zoneCode} District Code: ${districtCode}`,
        );
        await Zone.create(db, {
          code: zoneCode,
          description: zoneDescription || 'No description available',
          district_id: district.id,
          user_id: staff && staff.id,
        });
        created += 1;
      } else {
        const data = {
          description: zoneDescription || 'No description available',
        };
        if (staff) data.user_id = staff.id;

        await Zone.update(
          db,
          {
            code: zoneCode,
            district_id: district.id,
          },
          data,
        );
      }
    } catch (error) {
      console.log(
        `Error with message = ${error.message}, Zone Code ${zoneCode} row: ${
          index + 2
        }`,
      );
      throw error;
    }
  }

  return `${created} zones were created`;
};

const updateUser = async (data) => {
  let created = 0;
  let updated = 0;

  console.log('Start updating Users');
  console.log('records to process:  ' + data.length);
  for (let index = 0; index < data.length; index++) {
    const record = data[index];
    const { contact_phone_number, contact_email_address } = record;

    const email =
      contact_email_address === null
        ? ''
        : contact_email_address.toLowerCase().trim();
    const phoneNumber =
      contact_phone_number === null ? '' : contact_phone_number.trim();

    if (email !== '' && phoneNumber !== '') {
      try {
        let user = await User.findOne(db, {
          email,
        });

        if (user) {
          await User.update(
            db,
            { email },
            {
              phoneNumber,
            },
          );
          updated += 1;
        }
      } catch (error) {
        throw error;
      }
    }
  }

  return `${updated} users were updated`;
};

const updateAgreement = async (data) => {
  console.log('Start updating Agreements');
  console.log('records to process:  ' + data.length);
  const districts = await District.find(db, {});
  const districtCodesMap = {};
  districts.map((d) => {
    districtCodesMap[d.code] = d;
  });
  const zones = await Zone.find(db, {});
  const agreementTypes = await AgreementType.find(db, {});
  const agreementTypesMap = {};
  agreementTypes.map((at) => {
    agreementTypesMap[at.code] = at;
  });
  const exemption = await AgreementExemptionStatus.findOne(db, { code: 'N' }); // Not Exempt

  let created = 0;
  let updated = 0;
  let activeFTAAgreementIds = [];
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

    if (
      !isValidRecord(record) ||
      !agreementTypeCode ||
      !zoneCode ||
      !districtCode
    ) {
      skipping('Updating Agreement', agreementId, index);
      continue;
    }
    const district = districtCodesMap[districtCode];
    const zone = zones.find((zone) => {
      const { code, districtId } = zone;
      return code === zoneCode && districtId === district.id;
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
      activeFTAAgreementIds.push(agreementId);
      const agreement = await Agreement.findById(db, agreementId);
      if (agreement) {
        await Agreement.update(
          db,
          { forest_file_id: agreementId },
          {
            agreementStartDate: new Date(legal_effective_dt), // Short Format
            agreementEndDate: new Date(initial_expiry_dt), // Short Format
            zoneId: zone.id,
            agreementTypeId: agreementType.id,
            agreementExemptionStatusId: exemption.id,
            retired: false,
          },
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
          retired: false,
        });
        created += 1;
      }
    } catch (error) {
      console.log(
        `Error with message = ${error.message}, aId ${agreementId} row: ${
          index + 2
        }`,
      );
      throw error;
    }
  }
  const retiredAgreementIds = await Agreement.retireAgreements(
    db,
    activeFTAAgreementIds,
  );

  console.log(`Retired Agreements: ${retiredAgreementIds}`);
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
      non_use_nonbillable,
      non_use_billable,
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
        await Usage.update(
          db,
          { id: usage.id },
          {
            year: Number(calendar_year),
            authorizedAum: Number(authorized_use) || 0,
            temporaryIncrease: Number(temp_increase) || 0,
            totalNonUse:
              Number(non_use_nonbillable) + Number(non_use_billable) || 0,
            totalAnnualUse: Number(total_annual_use) || 0,
            agreementId: agreement.forestFileId,
          },
        );
        updated += 1;
      } else {
        await Usage.create(db, {
          year: Number(calendar_year),
          authorizedAum: Number(authorized_use) || 0,
          temporaryIncrease: Number(temp_increase) || 0,
          totalNonUse:
            Number(non_use_nonbillable) + Number(non_use_billable) || 0,
          totalAnnualUse: Number(total_annual_use) || 0,
          agreementId: agreement.forestFileId,
        });
        created += 1;
      }
    } catch (error) {
      console.log(
        `Error with message = ${
          error.message
        }, usage year ${calendar_year} row: ${index + 2}`,
      );
      throw error;
    }
  }

  return `${created} usage were created, ${updated} usage were updated`;
};

const updateClient = async (data) => {
  console.log('records to process:  ' + data.length);
  const clientTypes = await ClientType.find(db, {});
  let created = 0;
  let updated = 0;
  let deleted = 0;

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
      licensee_end_date: licenseeEndDate,
    } = record;

    if (!isValidRecord(record) || !clientLocationCode) {
      skipping('Updating Client', agreementId, index);
      continue;
    }
    const clientType = clientTypes.find((ct) => ct.code === clientTypeCode);

    try {
      let client = await Client.findOne(db, {
        client_number: clientNumber,
      });

      if (client) {
        if (clientTypeCode === 'P' || clientTypeCode === 'C') {
          const plans = await Plan.find(db, { agreement_id: agreementId });
          plans.forEach(async (plan) => {
            await PlanConfirmation.remove(db, {
              client_id: client.id,
              plan_id: plan.id,
            });
          });
          await ClientAgreement.remove(db, {
            client_id: client.id,
            agreement_id: agreementId,
          });
        }
        await Client.update(
          db,
          { client_number: clientNumber },
          {
            name: clientName || 'Unknown Name',
            locationCodes: Array.from(
              new Set(client.locationCodes.concat(clientLocationCode)),
            ),
            startDate: licenseeStartDate ? parseDate(licenseeStartDate) : null,
            endDate: licenseeEndDate ? parseDate(licenseeEndDate) : null,
          },
        );
        updated += 1;
      } else {
        client = await Client.create(db, {
          clientNumber: clientNumber,
          name: clientName || 'Unknown Name',
          locationCodes: [clientLocationCode],
          startDate: licenseeStartDate ? parseDate(licenseeStartDate) : null,
        });
        created += 1;
      }
      const agreement = await Agreement.findById(db, agreementId);
      const clientAgreement = await ClientAgreement.findOne(db, {
        agreement_id: agreementId,
        client_id: clientNumber,
      });
      /*if(clientAgreement && (typeof clientType === 'undefined')) { // clean up the stale ones here
        await ClientAgreement.remove(db, {
          agreement_id: agreementId,
          client_id: clientNumber,
        });
        deleted += 1;
      }*/
      if (agreement && !clientAgreement && clientType) {
        // only create if they are A or B
        await ClientAgreement.create(db, {
          agreement_id: agreementId,
          client_id: clientNumber,
          client_type_id: clientType.id,
        });
        const plan = await Plan.findOne(db, { agreement_id: agreementId });
        if (plan) {
          const existingConfirmation = await PlanConfirmation.findOne(db, {
            plan_id: plan.id,
            client_id: clientNumber,
          });
          if (!existingConfirmation) {
            await PlanConfirmation.create(db, {
              plan_id: plan.id,
              confirmed: false,
              client_id: clientNumber,
            });
          }
        }
      }
      if (agreement && clientAgreement && clientType) {
        // update if different
        if (clientAgreement.client_type_id !== clientType.id) {
          ClientAgreement.update(
            db,
            { id: clientAgreement.id },
            {
              agreement_id: agreementId,
              client_type_id: clientType.id,
            },
          );
        }
      }
    } catch (error) {
      console.log(
        `Error with message = ${
          error.message
        }, client number ${clientNumber} row: ${index + 2}`,
      );
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
    const githubrangeofficer = await User.findOne(db, {
      username: 'githubrangeofficer',
    });
    await Zone.update(
      db,
      { code: 'TEST3' },
      { user_id: githubrangeofficer.id },
    );
    const rangeAppTester = await User.findOne(db, {
      username: 'bceid\\rangeapptester',
    });
    await Zone.update(db, { code: 'TEST6' }, { user_id: rangeAppTester.id });

    // assign clients
    const clientsP = Object.values(mockData.users).map(async (user) => {
      const client = await Client.findOne(db, {
        client_number: user.client_number,
      });

      const { id } = await User.findOne(db, { username: user.username });
      await UserClientLink.create(db, {
        user_id: id,
        client_id: client.clientNumber,
        active: true,
        type: 'owner',
      });
    });

    await Promise.all(clientsP);

    console.log('Done preparing for test accounts');
  } catch (error) {
    console.log(`Error with message = ${error.message}`);
    throw error;
  }
};

const pruneConfirmations = async () => {
  console.log('Pruning confirmations...');
  const res = await db.raw(`
    WITH extra_confirmations AS (
      SELECT plan_confirmation.id FROM plan_confirmation
      LEFT JOIN plan ON plan.id = plan_confirmation.plan_id
	    AND plan.status_id NOT in (8,9,12,20,21)
      WHERE NOT EXISTS (
        SELECT 1
        FROM client_agreement
        WHERE agreement_id = plan.agreement_id
          AND client_id = plan_confirmation.client_id
      )
    )
    DELETE FROM plan_confirmation
    WHERE id IN (SELECT id FROM extra_confirmations)
  `);
  console.log(`Deleted ${res.rowCount} confirmations`);
};

const loadFile = (name) =>
  new Promise((resolve, reject) => {
    const records = [];
    fs.readFile(name, 'utf8', (err, contents) => {
      const parser = csv.parse(contents, (err, data) => {
        if (err) reject(err);

        const fields = data.shift();
        data.forEach((line) => {
          const record = {};
          fields.forEach((value, i) => {
            const key = value.replace(/ /g, '_').toLowerCase();
            if (i > 1) {
              record[key] = line[i];
              return;
            }
            record[key] = line[i];
          });
          records.push(record);
        });
        resolve(records);
      });
    });
  });

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

const updateFTAData = async (licensee, client, usage) => {
  let msg = '';
  msg = msg + (await updateDistrict(licensee)) + '\n';
  msg = msg + (await updateUser(licensee)) + '\n';
  msg = msg + (await updateAgreement(licensee)) + '\n';

  const filteredClientsAB = client.filter((item) =>
    ['A', 'B'].includes(item.forest_file_client_type_code),
  );
  const filteredClientsPC = client
    .filter((item) => ['P', 'C'].includes(item.forest_file_client_type_code))
    .filter((itemPC) => {
      const foundAB = filteredClientsAB.find(
        (itemAB) =>
          itemAB.forest_file_id === itemPC.forest_file_id &&
          itemAB.client_number === itemPC.client_number,
      );
      return !foundAB;
    });
  //create where missing, dispositions with signed plans will get client_id updated in plan_conf
  msg = msg + (await updateClient(filteredClientsAB)) + '\n';
  msg = msg + (await updateClient(filteredClientsPC)) + '\n';
  msg = msg + (await updateZone(licensee)) + '\n';
  msg = msg + (await updateUsage(usage));

  console.log(msg);
};

const loadFTADataFromCSV = async () => {
  const licensee = await loadFile(LICENSEE);
  const usage = await loadFile(USAGE);
  const client = await loadFile(CLIENT);

  await updateFTAData(licensee, client, usage);
};

const loadStaffDataFromCSV = async () => {
  console.log(`-- Current Dir: ${__dirname} --`);
  const user = await loadFile(USER);
  const msg = await updateUser(user);
  console.log(msg);
};

const loadFTADataFromAPI = async () => {
  console.log('trying to get api token ' + TOKEN_URL);
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
      console.log('Loading FTA data from API...');
      await loadFTADataFromCSV();
      console.log('Preparing test setup');
      await prepareTestSetup();
    } else {
      await loadFTADataFromAPI();
    }
  } catch (err) {
    console.log(`Error importing data, message = ${err.message}`);

    console.log(`${err.stack}`);
    process.exit(0);
  }
  process.exit(0);
};

main();
