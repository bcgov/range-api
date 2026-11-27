import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockWriteDomainAudit,
  mockDb,
  mockAgreementFindOne,
  mockAgreementFindById,
  mockAgreementUpdate,
  mockAgreementCreate,
  mockAgreementRetire,
  mockAgreementUnretire,
  mockAgreementUnretirePlans,
  mockAgreementTypeFind,
  mockUsageFindOne,
  mockUsageUpdate,
  mockUsageCreate,
  mockDistrictFind,
  mockDistrictFindOne,
  mockDistrictCreate,
  mockClientFindOne,
  mockClientUpdate,
  mockClientCreate,
  mockClientTypeFind,
  mockClientAgreementFindOne,
  mockClientAgreementUpdate,
  mockPlanFindOne,
  mockUserFind,
  mockUserUpdate,
  mockZoneFind,
  mockZoneFindOne,
  mockZoneUpdate,
  mockZoneCreate,
} = vi.hoisted(() => ({
  mockWriteDomainAudit: vi.fn().mockResolvedValue(undefined),
  mockDb: {},
  mockAgreementFindOne: vi.fn(),
  mockAgreementFindById: vi.fn().mockResolvedValue(null),
  mockAgreementUpdate: vi.fn().mockResolvedValue(undefined),
  mockAgreementCreate: vi.fn().mockResolvedValue(undefined),
  mockAgreementRetire: vi.fn().mockResolvedValue([]),
  mockAgreementUnretire: vi.fn().mockResolvedValue([]),
  mockAgreementUnretirePlans: vi.fn().mockResolvedValue(undefined),
  mockAgreementTypeFind: vi.fn().mockResolvedValue([]),
  mockUsageFindOne: vi.fn(),
  mockUsageUpdate: vi.fn().mockResolvedValue(undefined),
  mockUsageCreate: vi.fn().mockResolvedValue(undefined),
  mockDistrictFind: vi.fn().mockResolvedValue([]),
  mockDistrictFindOne: vi.fn(),
  mockDistrictCreate: vi.fn().mockResolvedValue(undefined),
  mockClientFindOne: vi.fn(),
  mockClientUpdate: vi.fn().mockResolvedValue(undefined),
  mockClientCreate: vi.fn(),
  mockClientTypeFind: vi.fn().mockResolvedValue([]),
  mockClientAgreementFindOne: vi.fn().mockResolvedValue(null),
  mockClientAgreementUpdate: vi.fn().mockResolvedValue(undefined),
  mockPlanFindOne: vi.fn().mockResolvedValue(null),
  mockUserFind: vi.fn().mockResolvedValue([]),
  mockUserUpdate: vi.fn().mockResolvedValue(undefined),
  mockZoneFind: vi.fn().mockResolvedValue([]),
  mockZoneFindOne: vi.fn(),
  mockZoneUpdate: vi.fn().mockResolvedValue(undefined),
  mockZoneCreate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/libs/audit.js', () => ({
  runAuditedBackgroundJob: vi.fn(async (_db, _jobName, runner) => runner()),
  writeDomainAudit: mockWriteDomainAudit,
}));

vi.mock('../../src/libs/db2/index.js', () => ({
  default: class DataManagerMock {
    constructor() {
      return {
        db: mockDb,
        Agreement: {
          findOne: mockAgreementFindOne,
          findById: mockAgreementFindById,
          update: mockAgreementUpdate,
          create: mockAgreementCreate,
          retireAgreements: mockAgreementRetire,
          unretireAgreements: mockAgreementUnretire,
          unretirePlans: mockAgreementUnretirePlans,
        },
        AgreementType: {
          find: mockAgreementTypeFind,
        },
        Client: {
          findOne: mockClientFindOne,
          update: mockClientUpdate,
          create: mockClientCreate,
        },
        ClientType: {
          find: mockClientTypeFind,
        },
        ClientAgreement: {
          findOne: mockClientAgreementFindOne,
          update: mockClientAgreementUpdate,
        },
        District: {
          find: mockDistrictFind,
          findOne: mockDistrictFindOne,
          create: mockDistrictCreate,
        },
        Plan: {
          findOne: mockPlanFindOne,
        },
        PlanConfirmation: {},
        Usage: {
          findOne: mockUsageFindOne,
          update: mockUsageUpdate,
          create: mockUsageCreate,
        },
        User: {
          find: mockUserFind,
          update: mockUserUpdate,
        },
        Zone: {
          find: mockZoneFind,
          findOne: mockZoneFindOne,
          update: mockZoneUpdate,
          create: mockZoneCreate,
        },
      };
    }
  },
}));

const usageRecord = {
  forest_file_id: 'RAN000001',
  calendar_year: '2026',
  authorized_use: '100',
  temp_increase: '0',
  non_use_nonbillable: '1',
  non_use_billable: '2',
  total_annual_use: '97',
};

const clientRecord = (overrides = {}) => ({
  forest_file_id: 'RAN000001',
  client_locn_code: '01',
  forest_file_client_type_code: 'A',
  client_number: 'C0000001',
  client_name: 'Test Client',
  licensee_start_date: '2008-05-22T07:00:00Z',
  licensee_end_date: '2019-10-16T22:27:13Z',
  ...overrides,
});

const licenseeRecord = (overrides = {}) => ({
  forest_file_id: 'RAN000001',
  district_admin_zone: 'Z1',
  org_unit_code: 'D01',
  zone_description: 'Zone One',
  file_type_code: 'E01',
  legal_effective_dt: '2020-01-01T08:00:00Z',
  initial_expiry_dt: '2030-12-31T08:00:00Z',
  contact_email_address: 'Staff@Example.com',
  contact_phone_number: '250-000-0000',
  ...overrides,
});

describe('import background job semantic audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgreementFindById.mockResolvedValue(null);
    mockAgreementRetire.mockResolvedValue([]);
    mockClientUpdate.mockResolvedValue(undefined);
    mockClientTypeFind.mockResolvedValue([]);
    mockClientAgreementFindOne.mockResolvedValue(null);
    mockUserFind.mockResolvedValue([]);
  });

  it('writes district.created audit when a district is inserted', async () => {
    mockDistrictFindOne.mockResolvedValue(null);
    const { updateDistrict } = await import('../../scripts/import.ts');

    await updateDistrict([
      {
        forest_file_id: 'RAN000001',
        org_unit_code: 'D01',
      },
    ]);

    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        action: 'district.created',
        entityType: 'district',
        entityId: 'D01',
        agreementId: 'RAN000001',
        method: 'SYSTEM',
        metadata: expect.objectContaining({
          code: 'D01',
          description: 'No description available',
        }),
      }),
    );
  });

  it('writes usage.updated audit with only the changed fields when a usage record changes', async () => {
    mockAgreementFindOne.mockResolvedValue({ forestFileId: 'RAN000001' });
    mockUsageFindOne.mockResolvedValue({
      id: 55,
      year: 2026,
      authorizedAum: 90,
      temporaryIncrease: 0,
      totalNonUse: 3,
      totalAnnualUse: 97,
    });
    const { updateUsage } = await import('../../scripts/import.ts');

    const result = await updateUsage([usageRecord]);

    expect(mockUsageUpdate).toHaveBeenCalledWith(mockDb, { id: 55 }, { authorizedAum: 100 });
    expect(mockWriteDomainAudit).toHaveBeenCalledTimes(1);
    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        action: 'usage.updated',
        entityType: 'usage',
        entityId: 'RAN000001:2026',
        agreementId: 'RAN000001',
        method: 'SYSTEM',
        metadata: {
          fields: ['authorizedAum'],
          authorizedAum: { from: 90, to: 100 },
        },
      }),
    );
    expect(result).toBe('0 usage were created, 1 usage were updated, 0 usage were unchanged');
  });

  it('skips the update and audit when a usage record is unchanged', async () => {
    mockAgreementFindOne.mockResolvedValue({ forestFileId: 'RAN000001' });
    mockUsageFindOne.mockResolvedValue({
      id: 55,
      year: 2026,
      authorizedAum: 100,
      temporaryIncrease: 0,
      totalNonUse: 3,
      totalAnnualUse: 97,
    });
    const { updateUsage } = await import('../../scripts/import.ts');

    const result = await updateUsage([usageRecord]);

    expect(mockUsageUpdate).not.toHaveBeenCalled();
    expect(mockWriteDomainAudit).not.toHaveBeenCalled();
    expect(result).toBe('0 usage were created, 0 usage were updated, 1 usage were unchanged');
  });

  it('writes usage.created audit when a usage record is inserted', async () => {
    mockAgreementFindOne.mockResolvedValue({ forestFileId: 'RAN000001' });
    mockUsageFindOne.mockResolvedValue(null);
    const { updateUsage } = await import('../../scripts/import.ts');

    await updateUsage([usageRecord]);

    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        action: 'usage.created',
        entityType: 'usage',
        entityId: 'RAN000001:2026',
        agreementId: 'RAN000001',
        method: 'SYSTEM',
        metadata: expect.objectContaining({
          year: 2026,
          authorizedAum: 100,
          temporaryIncrease: 0,
          totalNonUse: 3,
          totalAnnualUse: 97,
        }),
      }),
    );
  });

  it('parses FTA ISO timestamps and returns null for empty or invalid dates', async () => {
    const { parseDate } = await import('../../scripts/import.ts');

    expect(parseDate('2009-02-06T08:00:00Z').toISOString()).toBe('2009-02-06T08:00:00.000Z');
    expect(parseDate('2019-10-16T22:27:13Z').toISOString()).toBe('2019-10-16T22:27:13.000Z');
    expect(parseDate('2009-02-06').getTime()).toBe(new Date(2009, 1, 6).getTime());
    expect(parseDate(null)).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate('not-a-date')).toBeNull();
  });

  it('stores licensee dates and writes client.updated audit with valid dates', async () => {
    mockClientFindOne.mockResolvedValue({ id: 'C0000001', locationCodes: ['00'] });
    const { updateClient } = await import('../../scripts/import.ts');

    await updateClient([clientRecord()]);

    const expectedDates = {
      licenseeStartDate: new Date('2008-05-22T07:00:00Z'),
      licenseeEndDate: new Date('2019-10-16T22:27:13Z'),
    };
    expect(mockClientUpdate).toHaveBeenCalledWith(
      mockDb,
      { client_number: 'C0000001' },
      expect.objectContaining(expectedDates),
    );
    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        action: 'client.updated',
        entityType: 'client',
        entityId: 'C0000001',
        agreementId: 'RAN000001',
        metadata: expect.objectContaining({
          fields: ['name', 'locationCodes', 'licenseeStartDate', 'licenseeEndDate'],
          licenseeStartDate: { from: null, to: expectedDates.licenseeStartDate },
          licenseeEndDate: { from: null, to: expectedDates.licenseeEndDate },
        }),
      }),
    );
  });

  it('skips the client update and audit when stored values already match', async () => {
    mockClientFindOne.mockResolvedValue({
      id: 'C0000001',
      name: 'Test Client',
      locationCodes: ['01', '00'],
      licenseeStartDate: new Date('2008-05-22T07:00:00Z'),
      licenseeEndDate: new Date('2019-10-16T22:27:13Z'),
    });
    const { updateClient } = await import('../../scripts/import.ts');

    const result = await updateClient([clientRecord({ client_locn_code: '00' })]);

    expect(mockClientUpdate).not.toHaveBeenCalled();
    expect(mockWriteDomainAudit).not.toHaveBeenCalled();
    expect(result).toBe('0 clients were created, 0 clients were updated, 1 clients were unchanged');
  });

  it('writes a client with several agreements once using the last licensee dates', async () => {
    const stored = {
      id: 'C0000001',
      name: 'Test Client',
      locationCodes: ['01'],
      licenseeStartDate: new Date('2001-01-01T08:00:00Z'),
      licenseeEndDate: null,
    };
    mockClientFindOne.mockImplementation(async () => ({ ...stored }));
    mockClientUpdate.mockImplementation(async (_db, _where, values) => Object.assign(stored, values));
    const { updateClient } = await import('../../scripts/import.ts');

    await updateClient([
      clientRecord({
        forest_file_id: 'RAN000001',
        licensee_start_date: '2001-01-01T08:00:00Z',
        licensee_end_date: null,
      }),
      clientRecord({
        forest_file_id: 'RAN000002',
        licensee_start_date: '2010-01-01T08:00:00Z',
        licensee_end_date: null,
      }),
      clientRecord({
        forest_file_id: 'RAN000003',
        licensee_start_date: '2010-01-01T08:00:00Z',
        licensee_end_date: null,
      }),
    ]);

    expect(mockClientUpdate).toHaveBeenCalledTimes(1);
    expect(mockClientUpdate).toHaveBeenCalledWith(
      mockDb,
      { client_number: 'C0000001' },
      { licenseeStartDate: new Date('2010-01-01T08:00:00Z') },
    );
    expect(mockWriteDomainAudit).toHaveBeenCalledTimes(1);
  });

  it('resolves licensee dates per client with the last valid row winning', async () => {
    const { getLicenseeDatesByClient } = await import('../../scripts/import.ts');

    const dates = getLicenseeDatesByClient([
      clientRecord({ licensee_start_date: '2001-01-01T08:00:00Z' }),
      clientRecord({ licensee_start_date: '2010-01-01T08:00:00Z' }),
      clientRecord({ forest_file_id: 'BAD', licensee_start_date: '2020-01-01T08:00:00Z' }),
    ]);

    expect(dates.C0000001.licenseeStartDate).toEqual(new Date('2010-01-01T08:00:00Z'));
  });

  it('only updates client_agreement when the client type actually changes', async () => {
    mockClientFindOne.mockResolvedValue({
      id: 'C0000001',
      name: 'Test Client',
      locationCodes: ['01'],
      licenseeStartDate: new Date('2008-05-22T07:00:00Z'),
      licenseeEndDate: new Date('2019-10-16T22:27:13Z'),
    });
    mockClientTypeFind.mockResolvedValue([
      { id: 1, code: 'A' },
      { id: 2, code: 'B' },
    ]);
    mockAgreementFindById.mockResolvedValue({ forestFileId: 'RAN000001' });
    mockClientAgreementFindOne.mockResolvedValue({ id: 9, clientTypeId: 1 });
    const { updateClient } = await import('../../scripts/import.ts');

    await updateClient([clientRecord()]);
    expect(mockClientAgreementUpdate).not.toHaveBeenCalled();

    await updateClient([clientRecord({ forest_file_client_type_code: 'B' })]);
    expect(mockClientAgreementUpdate).toHaveBeenCalledTimes(1);
    expect(mockClientAgreementUpdate).toHaveBeenCalledWith(
      mockDb,
      { id: 9 },
      { agreement_id: 'RAN000001', client_type_id: 2 },
    );
  });

  describe('updateAgreement', () => {
    const existingAgreement = {
      forestFileId: 'RAN000001',
      agreementStartDate: new Date('2020-01-01T08:00:00Z'),
      agreementEndDate: new Date('2030-12-31T08:00:00Z'),
      zoneId: 7,
      agreementTypeId: 3,
      retired: false,
    };

    beforeEach(() => {
      mockDistrictFind.mockResolvedValue([{ id: 1, code: 'D01' }]);
      mockZoneFind.mockResolvedValue([{ id: 7, code: 'Z1', districtId: 1 }]);
      mockAgreementTypeFind.mockResolvedValue([{ id: 3, code: 'E01' }]);
    });

    it('skips the update and audit when the agreement is unchanged', async () => {
      mockAgreementFindById.mockResolvedValue({ ...existingAgreement });
      const { updateAgreement } = await import('../../scripts/import.ts');

      const result = await updateAgreement([licenseeRecord()]);

      expect(mockAgreementUpdate).not.toHaveBeenCalled();
      expect(mockWriteDomainAudit).not.toHaveBeenCalled();
      expect(result).toContain('0 agreements were updated. 1 agreements were unchanged.');
    });

    it('updates and audits only the changed agreement fields', async () => {
      mockAgreementFindById.mockResolvedValue({ ...existingAgreement, retired: true });
      const { updateAgreement } = await import('../../scripts/import.ts');

      await updateAgreement([licenseeRecord({ initial_expiry_dt: '2035-12-31T08:00:00Z' })]);

      const newEndDate = new Date('2035-12-31T08:00:00Z');
      expect(mockAgreementUpdate).toHaveBeenCalledWith(
        mockDb,
        { forest_file_id: 'RAN000001' },
        { agreementEndDate: newEndDate, retired: false },
      );
      expect(mockWriteDomainAudit).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          action: 'agreement.updated',
          entityId: 'RAN000001',
          metadata: {
            fields: ['agreementEndDate', 'retired'],
            agreementEndDate: { from: existingAgreement.agreementEndDate, to: newEndDate },
            retired: { from: true, to: false },
          },
        }),
      );
    });

    it('audits agreements newly retired by retireAgreements', async () => {
      mockAgreementFindById.mockResolvedValue({ ...existingAgreement });
      mockAgreementRetire.mockResolvedValue(['RAN000009']);
      const { updateAgreement } = await import('../../scripts/import.ts');

      await updateAgreement([licenseeRecord()]);

      expect(mockWriteDomainAudit).toHaveBeenCalledTimes(1);
      expect(mockWriteDomainAudit).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          action: 'agreement.updated',
          entityId: 'RAN000009',
          metadata: expect.objectContaining({ field: 'retired', to: true }),
        }),
      );
    });
  });

  describe('updateUser', () => {
    it('looks up each staff email once and skips users whose phone is unchanged', async () => {
      mockUserFind.mockResolvedValue([{ id: 1, email: 'staff@example.com', phoneNumber: '250-000-0000' }]);
      const { updateUser } = await import('../../scripts/import.ts');

      const result = await updateUser([licenseeRecord(), licenseeRecord({ forest_file_id: 'RAN000002' })]);

      expect(mockUserFind).toHaveBeenCalledTimes(1);
      expect(mockUserFind).toHaveBeenCalledWith(mockDb, { email: 'staff@example.com' });
      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(result).toBe('0 users were updated, 1 users were unchanged');
    });

    it('updates the phone number when it changed', async () => {
      mockUserFind.mockResolvedValue([{ id: 1, email: 'staff@example.com', phoneNumber: '250-111-1111' }]);
      const { updateUser } = await import('../../scripts/import.ts');

      await updateUser([licenseeRecord()]);

      expect(mockUserUpdate).toHaveBeenCalledWith(
        mockDb,
        { email: 'staff@example.com' },
        { phoneNumber: '250-000-0000' },
      );
    });
  });

  describe('updateZone', () => {
    beforeEach(() => {
      mockDistrictFind.mockResolvedValue([{ id: 1, code: 'D01' }]);
      mockUserFind.mockResolvedValue([{ id: 42 }]);
    });

    it('checks each zone once and skips it when unchanged', async () => {
      mockZoneFindOne.mockResolvedValue({ id: 7, code: 'Z1', description: 'Zone One', userId: 42 });
      const { updateZone } = await import('../../scripts/import.ts');

      const result = await updateZone([licenseeRecord(), licenseeRecord({ forest_file_id: 'RAN000002' })]);

      expect(mockZoneFindOne).toHaveBeenCalledTimes(1);
      expect(mockUserFind).toHaveBeenCalledTimes(1);
      expect(mockZoneUpdate).not.toHaveBeenCalled();
      expect(result).toBe('0 zones were created, 0 zones were updated, 1 zones were unchanged');
    });

    it('updates only the changed zone fields', async () => {
      mockZoneFindOne.mockResolvedValue({ id: 7, code: 'Z1', description: 'Zone One', userId: 5 });
      const { updateZone } = await import('../../scripts/import.ts');

      await updateZone([licenseeRecord()]);

      expect(mockZoneUpdate).toHaveBeenCalledWith(mockDb, { code: 'Z1', district_id: 1 }, { userId: 42 });
    });
  });

  it('stores licensee dates and writes client.created audit for a new client', async () => {
    mockClientFindOne.mockResolvedValue(null);
    mockClientCreate.mockResolvedValue({ id: 'C0000002', locationCodes: ['01'] });
    const { updateClient } = await import('../../scripts/import.ts');

    await updateClient([
      clientRecord({
        client_number: 'C0000002',
        client_name: 'New Client',
        licensee_start_date: '2009-02-06T08:00:00Z',
        licensee_end_date: null,
      }),
    ]);

    const expectedDates = {
      licenseeStartDate: new Date('2009-02-06T08:00:00Z'),
      licenseeEndDate: null,
    };
    expect(mockClientCreate).toHaveBeenCalledWith(mockDb, expect.objectContaining(expectedDates));
    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        action: 'client.created',
        entityType: 'client',
        entityId: 'C0000002',
        metadata: expect.objectContaining(expectedDates),
      }),
    );
  });
});
