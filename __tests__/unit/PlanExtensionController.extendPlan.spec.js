import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPlan, mockDb, mockPlanStatusHistory } = vi.hoisted(() => {
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
  return { mockPlan: plan, mockDb: db, mockPlanStatusHistory: planStatusHistory };
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

describe('PlanExtensionController.extendPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      user: {
        id: 11,
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
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
