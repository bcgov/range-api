import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockDb,
  MockUser,
  mockClient,
  mockUserClientLink,
  mockClientAgreement,
  mockUserFeedback,
  mockPlanStatusHistory,
  mockPlanConfirmation,
  mockDistrict,
  mockZone,
  mockPlan,
  mockPlanFile,
  mockPlanExtensionRequests,
  mockPlanSnapshot,
  mockWriteDomainAudit,
} = vi.hoisted(() => {
  const db = {
    transaction: vi.fn(() => ({
      execute: async (callback) => callback({}),
    })),
  };

  class UserModel {
    constructor(data = {}) {
      this.id = data.id;
    }

    static findOne = vi.fn();
    static findById = vi.fn();
    static update = vi.fn();

    getLinkedClientNumbers = vi.fn().mockResolvedValue([]);
  }

  return {
    mockDb: db,
    MockUser: UserModel,
    mockClient: {
      findOne: vi.fn(),
      findById: vi.fn(),
    },
    mockUserClientLink: {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
      update: vi.fn(),
    },
    mockClientAgreement: {
      find: vi.fn(),
      update: vi.fn(),
    },
    mockUserFeedback: {
      update: vi.fn(),
    },
    mockPlanStatusHistory: {
      update: vi.fn(),
    },
    mockPlanConfirmation: {
      update: vi.fn(),
    },
    mockDistrict: {
      update: vi.fn(),
    },
    mockZone: {
      update: vi.fn(),
    },
    mockPlan: {
      update: vi.fn(),
    },
    mockPlanFile: {
      update: vi.fn(),
    },
    mockPlanExtensionRequests: {
      find: vi.fn(),
      update: vi.fn(),
    },
    mockPlanSnapshot: {
      update: vi.fn(),
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
        User: MockUser,
        Client: mockClient,
        UserClientLink: mockUserClientLink,
        ClientAgreement: mockClientAgreement,
        UserFeedback: mockUserFeedback,
        PlanStatusHistory: mockPlanStatusHistory,
        PlanConfirmation: mockPlanConfirmation,
        District: mockDistrict,
        Zone: mockZone,
        Plan: mockPlan,
        PlanFile: mockPlanFile,
      };
    }
  },
}));

vi.mock('../../src/libs/db2/model/userDistricts.js', () => ({
  default: {
    update: vi.fn(),
  },
}));

vi.mock('../../src/libs/db2/model/plansnapshot.js', () => ({
  default: mockPlanSnapshot,
}));

vi.mock('../../src/libs/db2/model/planextensionrequests.js', () => ({
  default: mockPlanExtensionRequests,
}));

vi.mock('../../src/libs/audit.js', () => ({
  writeDomainAudit: mockWriteDomainAudit,
}));

describe('UserController semantic audit events', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    MockUser.findOne.mockResolvedValue({ id: 1 });
    mockUserFeedback.update.mockResolvedValue(undefined);
    mockUserClientLink.update.mockResolvedValue(undefined);
    mockClientAgreement.update.mockResolvedValue(undefined);
    mockPlanStatusHistory.update.mockResolvedValue(undefined);
    mockPlanConfirmation.update.mockResolvedValue(undefined);
    mockPlanExtensionRequests.update.mockResolvedValue(undefined);
    mockPlanSnapshot.update.mockResolvedValue(undefined);
    mockDistrict.update.mockResolvedValue(undefined);
    mockZone.update.mockResolvedValue(undefined);
    mockPlan.update.mockResolvedValue(undefined);
    mockPlanFile.update.mockResolvedValue(undefined);

    mockClient.findOne.mockResolvedValue({ clientNumber: '00019863', name: 'Client A' });
    mockUserClientLink.findOne.mockResolvedValue(null);
    mockUserClientLink.find.mockResolvedValue([]);
    mockUserClientLink.create.mockResolvedValue({ id: 10, clientId: '00019863', userId: '1' });
    mockClientAgreement.find.mockResolvedValue([]);
    MockUser.findById.mockResolvedValue({ id: 1, email: 'user@test.ca' });
    mockPlanExtensionRequests.find.mockResolvedValue([]);
    mockWriteDomainAudit.mockResolvedValue(undefined);
  });

  it('writes semantic event for mergeAccounts after successful transaction', async () => {
    const { UserController } = await import('../../src/router/controllers_v1/UserController.ts');

    const req = {
      params: { userId: '1' },
      body: { accountIds: [2, 3] },
      method: 'POST',
      originalUrl: '/api/v1/user/1/merge',
      route: { path: '/:userId/merge' },
      auditRequestId: 'req-user-1',
      auditCorrelationId: 'cid-user-1',
      user: { id: 99, roleId: 1 },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };

    await UserController.mergeAccounts(req, res);

    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'user.accounts.merged',
        entityType: 'user_account',
        entityId: '1',
        requestId: 'req-user-1',
        correlationId: 'cid-user-1',
      }),
    );
  });

  it('does not write semantic event when mergeAccounts transaction fails', async () => {
    const { UserController } = await import('../../src/router/controllers_v1/UserController.ts');

    mockUserFeedback.update.mockRejectedValue(new Error('db failure'));

    const req = {
      params: { userId: '1' },
      body: { accountIds: [2] },
      method: 'POST',
      originalUrl: '/api/v1/user/1/merge',
      route: { path: '/:userId/merge' },
      auditRequestId: 'req-user-2',
      auditCorrelationId: 'cid-user-2',
      user: { id: 99, roleId: 1 },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };

    await expect(UserController.mergeAccounts(req, res)).rejects.toThrow('db failure');
    expect(mockWriteDomainAudit).not.toHaveBeenCalled();
  });

  it('writes semantic event for addClientLink after successful transaction', async () => {
    const { UserController } = await import('../../src/router/controllers_v1/UserController.ts');

    const req = {
      params: { userId: '1' },
      body: { clientId: '00019863' },
      method: 'POST',
      originalUrl: '/api/v1/user/1/client',
      route: { path: '/:userId/client' },
      auditRequestId: 'req-user-3',
      auditCorrelationId: 'cid-user-3',
      user: { id: 99, roleId: 1 },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };

    await UserController.addClientLink(req, res);

    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'user.client_link.added',
        entityType: 'user_account',
        entityId: '1',
        requestId: 'req-user-3',
        correlationId: 'cid-user-3',
      }),
    );
  });

  it('does not write semantic event when addClientLink transaction fails', async () => {
    const { UserController } = await import('../../src/router/controllers_v1/UserController.ts');

    mockUserClientLink.create.mockRejectedValue(new Error('insert failed'));

    const req = {
      params: { userId: '1' },
      body: { clientId: '00019863' },
      method: 'POST',
      originalUrl: '/api/v1/user/1/client',
      route: { path: '/:userId/client' },
      auditRequestId: 'req-user-4',
      auditCorrelationId: 'cid-user-4',
      user: { id: 99, roleId: 1 },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };

    await expect(UserController.addClientLink(req, res)).rejects.toThrow('insert failed');
    expect(mockWriteDomainAudit).not.toHaveBeenCalled();
  });

  it('writes semantic event for removeClientLink after successful transaction', async () => {
    const { UserController } = await import('../../src/router/controllers_v1/UserController.ts');

    mockUserClientLink.remove.mockResolvedValue(1);

    const req = {
      params: { userId: '1', clientNumber: '00019863' },
      method: 'DELETE',
      originalUrl: '/api/v1/user/1/client/00019863',
      route: { path: '/:userId/client/:clientNumber' },
      auditRequestId: 'req-user-5',
      auditCorrelationId: 'cid-user-5',
      user: { id: 99, roleId: 1 },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };

    await UserController.removeClientLink(req, res);

    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'user.client_link.removed',
        entityType: 'user_account',
        entityId: '1',
        requestId: 'req-user-5',
        correlationId: 'cid-user-5',
      }),
    );
  });

  it('does not write semantic event when removeClientLink transaction fails', async () => {
    const { UserController } = await import('../../src/router/controllers_v1/UserController.ts');

    mockUserClientLink.remove.mockRejectedValue(new Error('delete failed'));

    const req = {
      params: { userId: '1', clientNumber: '00019863' },
      method: 'DELETE',
      originalUrl: '/api/v1/user/1/client/00019863',
      route: { path: '/:userId/client/:clientNumber' },
      auditRequestId: 'req-user-6',
      auditCorrelationId: 'cid-user-6',
      user: { id: 99, roleId: 1 },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };

    await expect(UserController.removeClientLink(req, res)).rejects.toThrow('delete failed');
    expect(mockWriteDomainAudit).not.toHaveBeenCalled();
  });
});
