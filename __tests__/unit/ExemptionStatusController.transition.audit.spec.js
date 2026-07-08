import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EXEMPTION_STATUS } from '../../src/constants.ts';

const {
  mockDb,
  mockAgreement,
  mockExemption,
  mockExemptionStatusHistory,
  mockZone,
  mockUser,
  mockNotificationHelper,
  mockWriteDomainAudit,
  mockUpdateAgreementExemptions,
} = vi.hoisted(() => {
  const db = {
    transaction: vi.fn(() => ({
      execute: async (callback) => callback({}),
    })),
  };

  return {
    mockDb: db,
    mockAgreement: {
      find: vi.fn(),
    },
    mockExemption: {
      findById: vi.fn(),
      update: vi.fn(),
    },
    mockExemptionStatusHistory: {
      create: vi.fn(),
      findByExemptionId: vi.fn(),
    },
    mockZone: {
      findById: vi.fn(),
    },
    mockUser: {
      findById: vi.fn(),
    },
    mockNotificationHelper: {
      getParticipants: vi.fn(),
      sendEmail: vi.fn(),
    },
    mockWriteDomainAudit: vi.fn().mockResolvedValue(undefined),
    mockUpdateAgreementExemptions: vi.fn().mockResolvedValue(undefined),
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
        Agreement: mockAgreement,
      };
    }
  },
}));

vi.mock('../../src/libs/db2/model/exemption.js', () => ({
  default: mockExemption,
}));

vi.mock('../../src/libs/db2/model/exemptionstatushistory.js', () => ({
  default: mockExemptionStatusHistory,
}));

vi.mock('../../src/libs/db2/model/zone.js', () => ({
  default: mockZone,
}));

vi.mock('../../src/libs/db2/model/user.js', () => ({
  default: mockUser,
}));

vi.mock('../../src/router/helpers/NotificationHelper.js', () => ({
  default: mockNotificationHelper,
}));

vi.mock('../../src/router/helpers/AgreementExemptionHelper.js', () => ({
  updateAgreementExemptions: mockUpdateAgreementExemptions,
}));

vi.mock('../../src/router/helpers/index.js', () => ({
  PlanRouteHelper: {
    canUserAccessThisAgreement: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/router/controllers_v1/ExemptionController.js', () => ({
  default: {
    prepareEmailAttachments: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../src/libs/audit.js', () => ({
  writeDomainAudit: mockWriteDomainAudit,
}));

describe('ExemptionStatusController.transition semantic audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockExemption.findById.mockResolvedValue({
      id: 99,
      agreementId: 'RAN076843',
      status: EXEMPTION_STATUS.DRAFT,
      attachments: [],
    });
    mockExemption.update.mockResolvedValue({
      id: 99,
      status: EXEMPTION_STATUS.PENDING_APPROVAL,
      attachments: [],
    });
    mockAgreement.find.mockResolvedValue([{ zoneId: 2 }]);
    mockZone.findById.mockResolvedValue({ id: 2, userId: 7 });
    mockUser.findById.mockResolvedValue({ givenName: 'Range', familyName: 'Officer', email: 'ro@test.ca' });
    mockNotificationHelper.getParticipants.mockResolvedValue({ emails: ['dm@test.ca'] });
    mockNotificationHelper.sendEmail.mockResolvedValue(undefined);
    mockExemptionStatusHistory.create.mockResolvedValue({});
    mockWriteDomainAudit.mockResolvedValue(undefined);
  });

  it('writes semantic event after successful transition', async () => {
    const { default: ExemptionStatusController } =
      await import('../../src/router/controllers_v1/ExemptionStatusController.ts');

    const req = {
      params: {
        agreementId: 'RAN076843',
        exemptionId: '99',
      },
      body: {
        action: 'submit',
        comment: 'ready',
      },
      method: 'POST',
      originalUrl: '/api/v1/agreement/RAN076843/exemption/99/transition',
      route: { path: '/:agreementId/exemption/:exemptionId/transition' },
      auditRequestId: 'req-ex-1',
      auditCorrelationId: 'cid-ex-1',
      user: {
        id: 11,
        roleId: 3,
        isRangeOfficer: () => true,
        isDecisionMaker: () => false,
        isAdministrator: () => false,
      },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await ExemptionStatusController.transition(req, res);

    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'exemption.status.changed',
        entityType: 'exemption',
        entityId: '99',
        requestId: 'req-ex-1',
        correlationId: 'cid-ex-1',
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('does not write semantic event when transition fails before commit', async () => {
    const { default: ExemptionStatusController } =
      await import('../../src/router/controllers_v1/ExemptionStatusController.ts');

    mockExemption.update.mockRejectedValue(new Error('db update failed'));

    const req = {
      params: {
        agreementId: 'RAN076843',
        exemptionId: '99',
      },
      body: {
        action: 'submit',
      },
      method: 'POST',
      originalUrl: '/api/v1/agreement/RAN076843/exemption/99/transition',
      route: { path: '/:agreementId/exemption/:exemptionId/transition' },
      auditRequestId: 'req-ex-2',
      auditCorrelationId: 'cid-ex-2',
      user: {
        id: 11,
        roleId: 3,
        isRangeOfficer: () => true,
        isDecisionMaker: () => false,
        isAdministrator: () => false,
      },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await expect(ExemptionStatusController.transition(req, res)).rejects.toThrow('db update failed');
    expect(mockWriteDomainAudit).not.toHaveBeenCalled();
  });
});
