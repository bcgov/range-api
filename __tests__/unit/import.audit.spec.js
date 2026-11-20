import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockWriteDomainAudit,
  mockDb,
  mockAgreementFindOne,
  mockAgreementFindById,
  mockUsageFindOne,
  mockUsageUpdate,
  mockUsageCreate,
  mockDistrictFindOne,
  mockDistrictCreate,
  mockClientFindOne,
  mockClientUpdate,
  mockClientCreate,
  mockClientTypeFind,
} = vi.hoisted(() => ({
  mockWriteDomainAudit: vi.fn().mockResolvedValue(undefined),
  mockDb: {},
  mockAgreementFindOne: vi.fn(),
  mockAgreementFindById: vi.fn().mockResolvedValue(null),
  mockUsageFindOne: vi.fn(),
  mockUsageUpdate: vi.fn().mockResolvedValue(undefined),
  mockUsageCreate: vi.fn().mockResolvedValue(undefined),
  mockDistrictFindOne: vi.fn(),
  mockDistrictCreate: vi.fn().mockResolvedValue(undefined),
  mockClientFindOne: vi.fn(),
  mockClientUpdate: vi.fn().mockResolvedValue(undefined),
  mockClientCreate: vi.fn(),
  mockClientTypeFind: vi.fn().mockResolvedValue([]),
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
        },
        AgreementType: {},
        Client: {
          findOne: mockClientFindOne,
          update: mockClientUpdate,
          create: mockClientCreate,
        },
        ClientType: {
          find: mockClientTypeFind,
        },
        ClientAgreement: {
          findOne: vi.fn().mockResolvedValue(null),
        },
        District: {
          findOne: mockDistrictFindOne,
          create: mockDistrictCreate,
        },
        Plan: {},
        PlanConfirmation: {},
        Usage: {
          findOne: mockUsageFindOne,
          update: mockUsageUpdate,
          create: mockUsageCreate,
        },
        User: {},
        Zone: {},
      };
    }
  },
}));

describe('import background job semantic audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('writes usage.updated audit when an existing usage record is changed', async () => {
    mockAgreementFindOne.mockResolvedValue({ forestFileId: 'RAN000001' });
    mockUsageFindOne.mockResolvedValue({ id: 55 });
    const { updateUsage } = await import('../../scripts/import.ts');

    await updateUsage([
      {
        forest_file_id: 'RAN000001',
        calendar_year: '2026',
        authorized_use: '100',
        temp_increase: '0',
        non_use_nonbillable: '1',
        non_use_billable: '2',
        total_annual_use: '97',
      },
    ]);

    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        action: 'usage.updated',
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

  it('writes usage.created audit when a usage record is inserted', async () => {
    mockAgreementFindOne.mockResolvedValue({ forestFileId: 'RAN000001' });
    mockUsageFindOne.mockResolvedValue(null);
    const { updateUsage } = await import('../../scripts/import.ts');

    await updateUsage([
      {
        forest_file_id: 'RAN000001',
        calendar_year: '2026',
        authorized_use: '100',
        temp_increase: '0',
        non_use_nonbillable: '1',
        non_use_billable: '2',
        total_annual_use: '97',
      },
    ]);

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

    await updateClient([
      {
        forest_file_id: 'RAN000001',
        client_locn_code: '01',
        forest_file_client_type_code: 'A',
        client_number: 'C0000001',
        client_name: 'Test Client',
        licensee_start_date: '2008-05-22T07:00:00Z',
        licensee_end_date: '2019-10-16T22:27:13Z',
      },
    ]);

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
          ...expectedDates,
        }),
      }),
    );
  });

  it('stores licensee dates and writes client.created audit for a new client', async () => {
    mockClientFindOne.mockResolvedValue(null);
    mockClientCreate.mockResolvedValue({ id: 'C0000002', locationCodes: ['01'] });
    const { updateClient } = await import('../../scripts/import.ts');

    await updateClient([
      {
        forest_file_id: 'RAN000001',
        client_locn_code: '01',
        forest_file_client_type_code: 'A',
        client_number: 'C0000002',
        client_name: 'New Client',
        licensee_start_date: '2009-02-06T08:00:00Z',
        licensee_end_date: null,
      },
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
