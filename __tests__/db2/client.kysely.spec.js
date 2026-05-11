import { db } from '../../src/libs/db2/kysely.js';
import Client from '../../src/libs/db2/model/client.js';

describe('Client model with Kysely', () => {
  const uid = `cli${Date.now()}`;
  const testAgreementId = `A${uid}`.slice(0, 9);
  const testClientNumber = '00019863';
  let testDistrictId;
  let testZoneId;

  beforeAll(async () => {
    const [{ id: districtId }] = await db
      .insertInto('ref_district')
      .values({
        code: `D${uid}`.slice(0, 10),
        description: `Test Client District ${uid}`,
      })
      .returning('id')
      .execute();
    testDistrictId = districtId;

    const [{ id: zoneId }] = await db
      .insertInto('ref_zone')
      .values({
        code: `Z${uid}`.slice(0, 10),
        description: `Test Client Zone ${uid}`,
        district_id: testDistrictId,
      })
      .returning('id')
      .execute();
    testZoneId = zoneId;

    await db
      .insertInto('agreement')
      .values({
        forest_file_id: testAgreementId,
        agreement_start_date: new Date(),
        agreement_end_date: new Date(Date.now() + 365 * 86400000),
        agreement_type_id: 1,
        zone_id: testZoneId,
        exemption_status: 'NOT_EXEMPTED',
      })
      .execute();

    await db
      .insertInto('client_agreement')
      .values({
        agreement_id: testAgreementId,
        client_id: testClientNumber,
        client_type_id: 1,
      })
      .execute();
  });

  afterAll(async () => {
    await db.deleteFrom('client_agreement').where('agreement_id', '=', testAgreementId).execute();
    await db.deleteFrom('agreement').where('forest_file_id', '=', testAgreementId).execute();
    await db.deleteFrom('ref_zone').where('id', '=', testZoneId).execute();
    await db.deleteFrom('ref_district').where('id', '=', testDistrictId).execute();
    await db.destroy();
  });

  test('find() returns clients with camelCase properties', async () => {
    const clients = await Client.find(db, { client_number: '00019863' });
    expect(Array.isArray(clients)).toBe(true);
    expect(clients.length).toBe(1);
    const client = clients[0];
    expect(client).toBeInstanceOf(Client);
    expect(client.clientNumber).toBe('00019863');
    expect(client).toHaveProperty('name');
    expect(client).toHaveProperty('locationCodes');
  });

  test('findById() returns a client by client_number', async () => {
    const client = await Client.findById(db, '00019863');
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(Client);
    expect(client.clientNumber).toBe('00019863');
    expect(client.name).toBeTruthy();
  });

  test('searchByNameWithAllFields() searches clients by name', async () => {
    const results = await Client.searchByNameWithAllFields(db, 'DEVICK');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toBeInstanceOf(Client);
    expect(results[0].clientNumber).toBeTruthy();
  });

  test('clientsForAgreement() returns clients for an agreement', async () => {
    const agreement = { forestFileId: testAgreementId };
    const clients = await Client.clientsForAgreement(db, agreement);
    expect(Array.isArray(clients)).toBe(true);
    expect(clients.length).toBeGreaterThan(0);
    const client = clients[0];
    expect(client).toBeInstanceOf(Client);
    expect(client.clientNumber).toBe(testClientNumber);
    expect(client).toHaveProperty('clientType');
    expect(client.clientType).toHaveProperty('code');
  });
});
