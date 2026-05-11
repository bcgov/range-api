import { db } from '../../src/libs/db2/kysely.js';
import Agreement from '../../src/libs/db2/model/agreement.js';
import { AGREEMENT_EXEMPTION_STATUS } from '../../src/constants';

describe('Agreement model with Kysely', () => {
  const uid = `agr${Date.now()}`;
  const testAgreementId = `A${uid}`.slice(0, 9);
  let testDistrictId;
  let testZoneId;

  beforeAll(async () => {
    const [{ id: districtId }] = await db
      .insertInto('ref_district')
      .values({
        code: `D${uid}`.slice(0, 10),
        description: `Test Agreement District ${uid}`,
      })
      .returning('id')
      .execute();
    testDistrictId = districtId;

    const [{ id: zoneId }] = await db
      .insertInto('ref_zone')
      .values({
        code: `Z${uid}`.slice(0, 10),
        description: `Test Agreement Zone ${uid}`,
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
  });

  afterAll(async () => {
    await db.deleteFrom('agreement').where('forest_file_id', '=', testAgreementId).execute();
    await db.deleteFrom('ref_zone').where('id', '=', testZoneId).execute();
    await db.deleteFrom('ref_district').where('id', '=', testDistrictId).execute();
    await db.destroy();
  });

  test('find() returns agreements with camelCase properties', async () => {
    const results = await Agreement.find(db, { forest_file_id: testAgreementId });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(1);
    const a = results[0];
    expect(a).toBeInstanceOf(Agreement);
    expect(a.forestFileId).toBe(testAgreementId);
    expect(a).toHaveProperty('agreementStartDate');
    expect(a).toHaveProperty('agreementEndDate');
  });

  test('findById() returns an agreement by forest_file_id', async () => {
    const a = await Agreement.findById(db, testAgreementId);
    expect(a).toBeDefined();
    expect(a).toBeInstanceOf(Agreement);
    expect(a.forestFileId).toBe(testAgreementId);
  });

  test('searchForTerm() searches agreements', async () => {
    const results = await Agreement.searchForTerm(db, testAgreementId);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  test('agreementsForClientId() returns agreement IDs for a client', async () => {
    const results = await Agreement.agreementsForClientId(db, '00019863');
    expect(Array.isArray(results)).toBe(true);
  });

  test('agreementsForZoneId() returns agreement IDs for a zone', async () => {
    const results = await Agreement.agreementsForZoneId(db, testZoneId);
    expect(Array.isArray(results)).toBe(true);
  });

  test('isGrazingSchedule() detects grazing agreement types', () => {
    const grazing = { agreementType: { id: 1 } };
    const haycutting = { agreementType: { id: 3 } };
    expect(Agreement.isGrazingSchedule(grazing)).toBe(true);
    expect(Agreement.isGrazingSchedule(haycutting)).toBe(false);
    expect(Agreement.isGrazingSchedule(null)).toBe(false);
    expect(Agreement.isGrazingSchedule({})).toBe(false);
  });

  test('isHayCuttingSchedule() detects haycutting agreement types', () => {
    const haycutting = { agreementType: { id: 3 } };
    const grazing = { agreementType: { id: 1 } };
    expect(Agreement.isHayCuttingSchedule(haycutting)).toBe(true);
    expect(Agreement.isHayCuttingSchedule(grazing)).toBe(false);
    expect(Agreement.isHayCuttingSchedule(null)).toBe(false);
  });

  test('getUsageStatusText() returns correct text', () => {
    expect(Agreement.getUsageStatusText(0)).toBe('No Use');
    expect(Agreement.getUsageStatusText(1)).toBe('Over Use');
    expect(Agreement.getUsageStatusText(2)).toBe('Normal');
    expect(Agreement.getUsageStatusText(null)).toBe('Normal');
  });

  test('getExemptionStatusText() returns correct text', () => {
    expect(Agreement.getExemptionStatusText(AGREEMENT_EXEMPTION_STATUS.NOT_EXEMPTED)).toBe('Not Exempted');
    expect(Agreement.getExemptionStatusText(AGREEMENT_EXEMPTION_STATUS.IN_PROGRESS)).toBe('In Progress');
    expect(Agreement.getExemptionStatusText(AGREEMENT_EXEMPTION_STATUS.EXEMPTED)).toBe('Exempted');
    expect(Agreement.getExemptionStatusText(AGREEMENT_EXEMPTION_STATUS.SCHEDULED)).toBe('Scheduled');
    expect(Agreement.getExemptionStatusText('UNKNOWN')).toBe('Unknown');
  });
});
