import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb, mockPlan, mockAgreement, mockPlanStatusController, mockPlanRouteHelper, mockWriteDomainAudit } =
  vi.hoisted(() => {
    const trxSelectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn(),
    };

    const trxDeleteBuilder = {
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(undefined),
    };

    const trx = {
      selectFrom: vi.fn(() => trxSelectBuilder),
      deleteFrom: vi.fn(() => trxDeleteBuilder),
    };

    const db = {
      transaction: vi.fn(() => ({
        execute: async (callback) => callback(trx),
      })),
    };

    return {
      mockDb: db,
      mockPlan: {
        findById: vi.fn(),
        isLegal: vi.fn(),
        isAmendment: vi.fn(),
        agreementIdForPlanId: vi.fn(),
        restoreVersion: vi.fn(),
      },
      mockAgreement: {},
      mockPlanStatusController: {
        getLatestLegalVersion: vi.fn(),
      },
      mockPlanRouteHelper: {
        canUserAccessThisAgreement: vi.fn(),
      },
      mockWriteDomainAudit: vi.fn().mockResolvedValue(undefined),
    };
  });

vi.mock('../../src/config/index.js', () => ({
  default: {
    db: {
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test',
      password: 'test',
    },
  },
}));

vi.mock('../../src/libs/db2/index.js', () => ({
  default: class DataManagerMock {
    constructor() {
      return {
        db: mockDb,
        Plan: mockPlan,
        Agreement: mockAgreement,
        PlanConfirmation: {},
        PlanStatus: {},
        AdditionalRequirement: {},
        PlanFile: {},
      };
    }
  },
}));

vi.mock('../../src/router/helpers/index.js', () => ({
  PlanRouteHelper: mockPlanRouteHelper,
}));

vi.mock('../../src/router/controllers_v1/PlanStatusController.js', () => ({
  default: mockPlanStatusController,
}));

vi.mock('../../src/libs/audit.js', () => ({
  writeDomainAudit: mockWriteDomainAudit,
}));

describe('PlanController.discardAmendment semantic audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlan.findById.mockResolvedValue({ id: 1199, amendmentTypeId: 3, statusId: 6 });
    mockPlan.isLegal.mockReturnValue(false);
    mockPlan.isAmendment.mockReturnValue(true);
    mockPlan.agreementIdForPlanId.mockResolvedValue('RAN076843');
    mockPlanRouteHelper.canUserAccessThisAgreement.mockResolvedValue(undefined);
    mockPlanStatusController.getLatestLegalVersion.mockResolvedValue({ id: 10, version: 2 });
    mockPlan.restoreVersion.mockResolvedValue(undefined);
    mockDb.transaction().execute(async (trx) => {
      trx.selectFrom().execute.mockResolvedValue([{ id: 11 }, { id: 12 }]);
      return undefined;
    });
    mockWriteDomainAudit.mockResolvedValue(undefined);
  });

  it('writes semantic event after successful discard', async () => {
    const { default: PlanController } = await import('../../src/router/controllers_v1/PlanController.ts');

    const req = {
      params: { planId: '1199' },
      method: 'POST',
      originalUrl: '/api/v1/plan/1199/discard-amendment',
      route: { path: '/:planId/discard-amendment' },
      auditRequestId: 'req-plan-1',
      auditCorrelationId: 'cid-plan-1',
      user: { id: 99, roleId: 1 },
    };
    const res = {
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };

    await PlanController.discardAmendment(req, res);

    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        requestId: 'req-plan-1',
        correlationId: 'cid-plan-1',
        action: 'plan.amendment.discarded',
        entityType: 'plan',
        entityId: '1199',
        agreementId: 'RAN076843',
      }),
    );

    const [, payload] = mockWriteDomainAudit.mock.calls[0];
    expect(payload.metadata).toEqual({
      restoredVersion: 2,
      discardedSnapshotCount: 2,
    });
  });

  it('does not write semantic event when restore fails', async () => {
    const { default: PlanController } = await import('../../src/router/controllers_v1/PlanController.ts');
    mockPlan.restoreVersion.mockRejectedValue(new Error('restore failed'));

    const req = {
      params: { planId: '1199' },
      method: 'POST',
      originalUrl: '/api/v1/plan/1199/discard-amendment',
      route: { path: '/:planId/discard-amendment' },
      auditRequestId: 'req-plan-2',
      auditCorrelationId: 'cid-plan-2',
      user: { id: 99, roleId: 1 },
    };
    const res = {
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };

    await expect(PlanController.discardAmendment(req, res)).rejects.toThrow('restore failed');
    expect(mockWriteDomainAudit).not.toHaveBeenCalled();
  });
});
