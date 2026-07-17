import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockWriteDomainAudit,
  mockDb,
  mockAgreementFindOne,
  mockUsageFindOne,
  mockUsageUpdate,
  mockUsageCreate,
  mockDistrictFindOne,
  mockDistrictCreate,
} = vi.hoisted(() => ({
  mockWriteDomainAudit: vi.fn().mockResolvedValue(undefined),
  mockDb: {},
  mockAgreementFindOne: vi.fn(),
  mockUsageFindOne: vi.fn(),
  mockUsageUpdate: vi.fn().mockResolvedValue(undefined),
  mockUsageCreate: vi.fn().mockResolvedValue(undefined),
  mockDistrictFindOne: vi.fn(),
  mockDistrictCreate: vi.fn().mockResolvedValue(undefined),
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
        },
        AgreementType: {},
        Client: {},
        ClientType: {},
        ClientAgreement: {},
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
});
