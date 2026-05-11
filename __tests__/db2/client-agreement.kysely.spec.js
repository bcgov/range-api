import { db } from '../../src/libs/db2/kysely.js';
import ClientAgreement from '../../src/libs/db2/model/ClientAgreement.js';

describe('ClientAgreement model with Kysely', () => {
  const uid = `ca${Date.now()}`;
  const testAgreementId = `A${uid}`.slice(0, 9);
  const testClientNumber = '00019863';
  let testDistrictId;
  let testZoneId;
  let testClientAgreementId;

  beforeAll(async () => {
    // Create district
    const [{ id: districtId }] = await db
      .insertInto('ref_district')
      .values({
        code: `D${uid}`.slice(0, 10),
        description: `Test CA District ${uid}`,
      })
      .returning('id')
      .execute();
    testDistrictId = districtId;

    // Create zone
    const [{ id: zoneId }] = await db
      .insertInto('ref_zone')
      .values({
        code: `Z${uid}`.slice(0, 10),
        description: `Test CA Zone ${uid}`,
        district_id: testDistrictId,
      })
      .returning('id')
      .execute();
    testZoneId = zoneId;

    // Create agreement
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

    // Create client_agreement
    const [{ id: caId }] = await db
      .insertInto('client_agreement')
      .values({
        agreement_id: testAgreementId,
        client_id: testClientNumber,
        client_type_id: 1,
      })
      .returning('id')
      .execute();
    testClientAgreementId = caId;
  });

  afterAll(async () => {
    await db.deleteFrom('client_agreement').where('agreement_id', '=', testAgreementId).execute();
    await db.deleteFrom('agreement').where('forest_file_id', '=', testAgreementId).execute();
    await db.deleteFrom('ref_zone').where('id', '=', testZoneId).execute();
    await db.deleteFrom('ref_district').where('id', '=', testDistrictId).execute();
    await db.destroy();
  });

  test('find() returns client agreements with camelCase properties', async () => {
    const results = await ClientAgreement.find(db, { agreement_id: testAgreementId });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(1);
    const ca = results[0];
    expect(ca).toBeInstanceOf(ClientAgreement);
    expect(ca.agreementId).toBe(testAgreementId);
    expect(ca).toHaveProperty('clientId', testClientNumber);
    expect(ca).toHaveProperty('clientTypeId', 1);
  });

  test('findById() returns a client agreement by id', async () => {
    const ca = await ClientAgreement.findById(db, testClientAgreementId);
    expect(ca).toBeDefined();
    expect(ca).toBeInstanceOf(ClientAgreement);
    expect(ca.id).toBe(testClientAgreementId);
    expect(ca.agreementId).toBe(testAgreementId);
  });

  test('create() inserts and returns a new client agreement', async () => {
    const newCa = await ClientAgreement.create(db, {
      agreementId: testAgreementId,
      clientId: testClientNumber,
      clientTypeId: 2,
    });

    expect(newCa).toBeDefined();
    expect(newCa).toBeInstanceOf(ClientAgreement);
    expect(newCa.agreementId).toBe(testAgreementId);
    expect(newCa.clientTypeId).toBe(2);

    await db.deleteFrom('client_agreement').where('id', '=', newCa.id).execute();
  });

  test('update() modifies and returns updated client agreement', async () => {
    const updated = await ClientAgreement.update(db, { id: testClientAgreementId }, { clientTypeId: 2 });

    expect(updated).toBeDefined();
    expect(updated.clientTypeId).toBe(2);

    await ClientAgreement.update(db, { id: testClientAgreementId }, { clientTypeId: 1 });
  });

  test('remove() deletes matching row', async () => {
    const { id } = await db
      .insertInto('client_agreement')
      .values({
        agreement_id: testAgreementId,
        client_id: testClientNumber,
        client_type_id: 1,
      })
      .returning('id')
      .executeTakeFirst();

    const count = await ClientAgreement.remove(db, { id });
    expect(Number(count)).toBeGreaterThan(0);

    const found = await ClientAgreement.findById(db, id);
    expect(found).toBeUndefined();
  });
});
