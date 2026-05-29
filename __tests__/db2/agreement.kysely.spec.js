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

  test('findWithTypeZoneDistrictExemption with countOnly returns integer matching filtered agreement count', async () => {
    const where = { 'ref_zone.id': testZoneId };
    const filterSettings = { countOnly: true, orderBy: 'plan.agreement_id', order: 'asc', columnFilters: {} };

    const count = await Agreement.findWithTypeZoneDistrictExemption(db, where, filterSettings);

    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(1);

    const rows = await Agreement.findWithTypeZoneDistrictExemption(db, where, {
      ...filterSettings,
      countOnly: false,
    });
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(count);
  });

  test('findWithTypeZoneDistrictExemption with page and limit returns only that page of agreements', async () => {
    const where = { 'ref_zone.id': testZoneId };
    const baseSettings = { orderBy: 'agreement.forest_file_id', order: 'asc', columnFilters: {} };

    const total = await Agreement.findWithTypeZoneDistrictExemption(db, where, { ...baseSettings, countOnly: true });
    expect(total).toBeGreaterThanOrEqual(1);

    const page1 = await Agreement.findWithTypeZoneDistrictExemption(db, where, {
      ...baseSettings,
      page: 1,
      limit: 5,
    });
    expect(Array.isArray(page1)).toBe(true);
    expect(page1.length).toBeLessThanOrEqual(5);
    expect(page1.length).toBeGreaterThan(0);

    if (total > 5) {
      const page2 = await Agreement.findWithTypeZoneDistrictExemption(db, where, {
        ...baseSettings,
        page: 2,
        limit: 5,
      });
      expect(Array.isArray(page2)).toBe(true);
      expect(page2.length).toBeLessThanOrEqual(5);

      const firstIds = page1.map((a) => a.forestFileId);
      const secondIds = page2.map((a) => a.forestFileId);
      for (const id of secondIds) {
        expect(firstIds).not.toContain(id);
      }
    }
  });

  test('findWithTypeZoneDistrictExemption with page:null, limit:null returns all matching agreements (export behavior)', async () => {
    const where = { 'ref_zone.id': testZoneId };
    const baseSettings = { orderBy: 'agreement.forest_file_id', order: 'asc', columnFilters: {} };

    const total = await Agreement.findWithTypeZoneDistrictExemption(db, where, { ...baseSettings, countOnly: true });

    const withPagination = await Agreement.findWithTypeZoneDistrictExemption(db, where, {
      ...baseSettings,
      page: 1,
      limit: 1,
    });
    expect(withPagination.length).toBe(1);

    const withoutPagination = await Agreement.findWithTypeZoneDistrictExemption(db, where, {
      ...baseSettings,
      page: null,
      limit: null,
    });
    expect(withoutPagination.length).toBe(total);
  });

  describe('stable ordering', () => {
    const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const agreementId1 = `TIE${shortId}A`;
    const agreementId2 = `TIE${shortId}B`;

    beforeAll(async () => {
      await db
        .insertInto('agreement')
        .values({
          forest_file_id: agreementId1,
          agreement_start_date: new Date(),
          agreement_end_date: new Date(Date.now() + 365 * 86400000),
          agreement_type_id: 1,
          zone_id: testZoneId,
          exemption_status: 'NOT_EXEMPTED',
        })
        .execute();
      await db
        .insertInto('agreement')
        .values({
          forest_file_id: agreementId2,
          agreement_start_date: new Date(),
          agreement_end_date: new Date(Date.now() + 365 * 86400000),
          agreement_type_id: 1,
          zone_id: testZoneId,
          exemption_status: 'NOT_EXEMPTED',
        })
        .execute();
    });

    afterAll(async () => {
      await db.deleteFrom('agreement').where('forest_file_id', 'in', [agreementId1, agreementId2]).execute();
    });

    test('returns deterministic order via forest_file_id tiebreaker when primary sort column has duplicate values', async () => {
      const where = { 'ref_zone.id': testZoneId };
      const filterSettings = { orderBy: 'agreement.agreement_type_id', order: 'asc', columnFilters: {} };

      const firstCall = await Agreement.findWithTypeZoneDistrictExemption(db, where, filterSettings);
      const secondCall = await Agreement.findWithTypeZoneDistrictExemption(db, where, filterSettings);

      const firstIds = firstCall.map((a) => a.forestFileId);
      const secondIds = secondCall.map((a) => a.forestFileId);

      expect(firstIds).toEqual(secondIds);
    });

    test('agreements with same sort value are ordered by forest_file_id ascending', async () => {
      const where = { forest_file_id: [agreementId1, agreementId2] };
      const filterSettings = { orderBy: 'agreement.agreement_type_id', order: 'asc', columnFilters: {} };

      const results = await Agreement.findWithTypeZoneDistrictExemption(db, where, filterSettings);
      const ids = results.map((a) => a.forestFileId);

      expect(ids).toEqual([agreementId1, agreementId2]);
    });
  });
});
