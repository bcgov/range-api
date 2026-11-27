import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockWriteDomainAudit, mockPlanUpdate } = vi.hoisted(() => ({
  mockWriteDomainAudit: vi.fn().mockResolvedValue(undefined),
  mockPlanUpdate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/libs/audit.js', () => ({
  runAuditedBackgroundJob: vi.fn(async (_db, _jobName, runner) => runner()),
  writeDomainAudit: mockWriteDomainAudit,
}));

vi.mock('../../src/router/helpers/AgreementExemptionHelper.js', () => ({
  updateAgreementExemptions: vi.fn(),
  sendAgreementExemptionStatusEmails: vi.fn(),
}));

vi.mock('../../src/router/helpers/PlanExtensionHelper.js', () => ({
  reconcilePlanExtensionVoters: vi.fn(),
}));

vi.mock('../../src/router/helpers/NotificationHelper.js', () => ({
  default: { sendEmail: vi.fn() },
}));

vi.mock('../../src/libs/db2/index.js', () => ({
  default: class DataManagerMock {
    constructor() {
      return {
        db: {},
        Plan: { table: 'plan', update: mockPlanUpdate },
        PlanExtensionRequests: {},
        User: {},
      };
    }
  },
}));

const createTrx = (plans) => {
  const query = {
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(plans),
  };
  return { selectFrom: vi.fn().mockReturnValue(query) };
};

describe('plan_extension_exemption processExpiredPlans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps retired and already expired plans unchanged', async () => {
    const { processExpiredPlans } = await import('../../scripts/plan_extension_exemption.ts');
    const trx = createTrx([
      { id: 1, status_id: 25, agreement_id: 'RAN000001', extension_status: null },
      { id: 2, status_id: 26, agreement_id: 'RAN000002', extension_status: null },
    ]);

    await processExpiredPlans(trx);

    expect(mockPlanUpdate).not.toHaveBeenCalled();
    expect(mockWriteDomainAudit).not.toHaveBeenCalled();
  });

  it('expires other ended plans and audits the status change', async () => {
    const { processExpiredPlans } = await import('../../scripts/plan_extension_exemption.ts');
    const trx = createTrx([{ id: 3, status_id: 20, agreement_id: 'RAN000003', extension_status: null }]);

    await processExpiredPlans(trx);

    expect(mockPlanUpdate).toHaveBeenCalledWith(trx, { id: 3 }, { status_id: 26 });
    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      trx,
      expect.objectContaining({
        action: 'plan.updated',
        entityId: 3,
        metadata: { field: 'status_id', from: 20, to: 26 },
      }),
    );
  });
});
