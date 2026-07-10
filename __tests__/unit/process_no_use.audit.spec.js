import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockWriteDomainAudit, createDbMock } = vi.hoisted(() => {
  const writeDomainAudit = vi.fn().mockResolvedValue(undefined);

  const createDb = () => {
    const updateExecute = vi.fn().mockResolvedValue(undefined);
    const updateWhere = vi.fn().mockReturnValue({ execute: updateExecute });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const updateTable = vi.fn().mockReturnValue({ set: updateSet });

    const refUsageQuery = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({ total_annual_use: '100' }),
    };

    const planQuery = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([
        {
          id: 77,
          replacement_plan_id: null,
          extension_status: 10,
          created_at: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    };

    const scheduleQuery = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
    };

    const selectFrom = vi.fn((table) => {
      if (table === 'ref_usage') return refUsageQuery;
      if (table === 'plan') return planQuery;
      if (table === 'grazing_schedule') return scheduleQuery;
      throw new Error(`Unexpected selectFrom table: ${table}`);
    });

    return {
      db: {
        selectFrom,
        updateTable,
      },
      fns: {
        selectFrom,
        updateTable,
        updateSet,
        updateWhere,
        updateExecute,
      },
    };
  };

  return {
    mockWriteDomainAudit: writeDomainAudit,
    createDbMock: createDb,
  };
});

const dmInstance = createDbMock();

vi.mock('../../src/libs/audit.js', () => ({
  runAuditedBackgroundJob: vi.fn(async (_db, _jobName, runner) => runner()),
  writeDomainAudit: mockWriteDomainAudit,
}));

vi.mock('../../src/libs/db2/index.js', () => ({
  default: class DataManagerMock {
    constructor() {
      return {
        db: dmInstance.db,
      };
    }
  },
}));

describe('process_no_use agreement mutation audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes agreement.updated semantic audit after agreement usage update', async () => {
    const { processAgreementUsageStatus } = await import('../../scripts/process_no_use.ts');

    await processAgreementUsageStatus(null, 'RAN076843', 1, 2026);

    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      dmInstance.db,
      expect.objectContaining({
        action: 'agreement.updated',
        entityType: 'agreement',
        entityId: 'RAN076843',
        agreementId: 'RAN076843',
        method: 'SYSTEM',
      }),
    );
  });

  it('writes audit using provided transaction connection', async () => {
    const trxInstance = createDbMock();
    const { processAgreementUsageStatus } = await import('../../scripts/process_no_use.ts');

    await processAgreementUsageStatus(trxInstance.db, 'RAN000001', 1, 2026);

    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      trxInstance.db,
      expect.objectContaining({
        action: 'agreement.updated',
        entityId: 'RAN000001',
      }),
    );
  });
});
