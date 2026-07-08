import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPlan, mockDb, mockPlanStatusHistory, mockWriteDomainAudit } = vi.hoisted(() => {
  const plan = {
    findOne: vi.fn(),
    update: vi.fn(),
    createSnapshot: vi.fn(),
  };
  const planStatusHistory = {
    create: vi.fn(),
  };
  const db = {
    transaction: vi.fn(() => ({
      execute: async (callback) => callback({}),
    })),
  };
  const writeDomainAudit = vi.fn().mockResolvedValue(undefined);
  return {
    mockPlan: plan,
    mockDb: db,
    mockPlanStatusHistory: planStatusHistory,
    mockWriteDomainAudit: writeDomainAudit,
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
        PlanExtensionRequests: {},
        PlanStatusHistory: mockPlanStatusHistory,
      };
    }
  },
}));

vi.mock('../../src/libs/audit.js', () => ({
  writeDomainAudit: mockWriteDomainAudit,
}));

describe('PlanExtensionController.extendPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteDomainAudit.mockResolvedValue(undefined);
  });

  it('sets extensionDate when extending a plan', async () => {
    const { default: PlanExtensionController } =
      await import('../../src/router/controllers_v1/PlanExtensionController.ts');

    mockPlan.findOne.mockResolvedValue({
      id: 1199,
      statusId: 8,
      extensionStatus: 3,
      extensionReceivedVotes: 1,
      extensionRequiredVotes: 1,
      replacementOf: null,
      planEndDate: new Date('2030-12-31T00:00:00.000Z'),
    });
    mockPlanStatusHistory.create.mockResolvedValue({});
    mockPlan.update.mockResolvedValue({});
    mockPlan.createSnapshot.mockResolvedValue({});

    const req = {
      params: { planId: '1199' },
      query: { endDate: '2031-12-31' },
      method: 'PUT',
      originalUrl: '/api/v1/plan/1199/extension/extend?endDate=2031-12-31',
      route: { path: '/:planId/extension/extend' },
      auditRequestId: 'req-1',
      auditCorrelationId: 'cid-1',
      user: {
        id: 11,
        roleId: 2,
        isDecisionMaker: () => false,
        isAdministrator: () => true,
      },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };

    await PlanExtensionController.extendPlan(req, res);

    expect(mockPlan.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: '1199' },
      expect.objectContaining({
        planEndDate: '2031-12-31',
        statusId: 9,
        amendmentTypeId: 4,
        extensionStatus: 4,
        extensionDate: expect.any(Date),
      }),
    );
    expect(mockPlan.createSnapshot).toHaveBeenCalledWith(expect.anything(), '1199', req.user);
    expect(mockPlanStatusHistory.create).toHaveBeenCalledWith(expect.anything(), {
      fromPlanStatusId: 8,
      toPlanStatusId: 9,
      note: ' ',
      planId: '1199',
      userId: 11,
    });
    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'plan.extension.extended',
        entityType: 'plan',
        entityId: '1199',
        requestId: 'req-1',
        correlationId: 'cid-1',
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('does not write semantic event when transaction fails before commit', async () => {
    const { default: PlanExtensionController } =
      await import('../../src/router/controllers_v1/PlanExtensionController.ts');

    mockPlan.findOne.mockResolvedValue({
      id: 1199,
      statusId: 8,
      extensionStatus: 3,
      extensionReceivedVotes: 1,
      extensionRequiredVotes: 1,
      replacementOf: null,
      planEndDate: new Date('2030-12-31T00:00:00.000Z'),
      agreementId: 'RAN000001',
    });
    mockPlanStatusHistory.create.mockResolvedValue({});
    mockPlan.update.mockRejectedValue(new Error('db write failed'));

    const req = {
      params: { planId: '1199' },
      query: { endDate: '2031-12-31' },
      method: 'PUT',
      originalUrl: '/api/v1/plan/1199/extension/extend?endDate=2031-12-31',
      route: { path: '/:planId/extension/extend' },
      auditRequestId: 'req-2',
      auditCorrelationId: 'cid-2',
      user: {
        id: 11,
        roleId: 2,
        isDecisionMaker: () => false,
        isAdministrator: () => true,
      },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };

    await expect(PlanExtensionController.extendPlan(req, res)).rejects.toThrow('db write failed');
    expect(mockWriteDomainAudit).not.toHaveBeenCalled();
  });
});
