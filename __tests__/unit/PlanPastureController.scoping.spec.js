import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  mockDb,
  mockAgreement,
  mockPlan,
  mockPasture,
  mockPlantCommunity,
  mockPlantCommunityAction,
  mockIndicatorPlant,
  mockMonitoringArea,
  mockPlanRouteHelper,
} = vi.hoisted(() => ({
  mockDb: {},
  mockAgreement: {},
  mockPlan: { agreementIdForPlanId: vi.fn() },
  mockPasture: { findById: vi.fn(), findOne: vi.fn(), update: vi.fn(), remove: vi.fn() },
  mockPlantCommunity: { findById: vi.fn(), update: vi.fn(), remove: vi.fn() },
  mockPlantCommunityAction: { findById: vi.fn(), update: vi.fn() },
  mockIndicatorPlant: { findById: vi.fn(), update: vi.fn() },
  mockMonitoringArea: { findById: vi.fn(), update: vi.fn() },
  mockPlanRouteHelper: { canUserAccessThisAgreement: vi.fn() },
}));

vi.mock('../../src/config/index.js', () => ({
  default: { db: { host: 'localhost', port: 5432, database: 'test', user: 'test', password: 'test' } },
}));

vi.mock('../../src/libs/db2/index.js', () => ({
  default: class DataManagerMock {
    constructor() {
      return {
        db: mockDb,
        Agreement: mockAgreement,
        Plan: mockPlan,
        Pasture: mockPasture,
        PlantCommunity: mockPlantCommunity,
        PlantCommunityAction: mockPlantCommunityAction,
        IndicatorPlant: mockIndicatorPlant,
        MonitoringArea: mockMonitoringArea,
        MonitoringAreaPurpose: {},
      };
    }
  },
}));

vi.mock('../../src/router/helpers/index.js', () => ({
  PlanRouteHelper: mockPlanRouteHelper,
}));

const buildRes = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  send: vi.fn().mockReturnThis(),
  end: vi.fn(),
});

const baseReq = (params, body = {}) => ({ params, body, user: { id: 1 } });

describe('PlanPastureController parent scoping (#550)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlan.agreementIdForPlanId.mockResolvedValue('RAN077751');
    mockPlanRouteHelper.canUserAccessThisAgreement.mockResolvedValue(undefined);
  });

  it('rejects updating a plant community that belongs to another pasture', async () => {
    const { default: PlanPastureController } = await import('../../src/router/controllers_v1/PlanPastureController.ts');

    mockPasture.findById.mockResolvedValue({ id: 5, planId: 1110 });
    mockPlantCommunity.findById.mockResolvedValue({ id: 2931, pastureId: 5725 });
    mockPlantCommunity.update.mockResolvedValue({});

    await expect(
      PlanPastureController.updatePlantCommunity(
        baseReq({ planId: '1110', pastureId: '5', communityId: '2931' }, { notes: 'hijack' }),
        buildRes(),
      ),
    ).rejects.toMatchObject({ code: 404 });
    expect(mockPlantCommunity.update).not.toHaveBeenCalled();
  });

  it('updates a plant community whose chain matches the URL', async () => {
    const { default: PlanPastureController } = await import('../../src/router/controllers_v1/PlanPastureController.ts');

    mockPasture.findById.mockResolvedValue({ id: 5, planId: 1110 });
    mockPlantCommunity.findById.mockResolvedValue({ id: 9, pastureId: 5 });
    mockPlantCommunity.update.mockResolvedValue({ id: 9 });
    const res = buildRes();

    await PlanPastureController.updatePlantCommunity(
      baseReq({ planId: '1110', pastureId: '5', communityId: '9' }, { notes: 'ok' }),
      res,
    );
    expect(mockPlantCommunity.update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  it('rejects updating a pasture from another plan', async () => {
    const { default: PlanPastureController } = await import('../../src/router/controllers_v1/PlanPastureController.ts');

    mockPasture.findById.mockResolvedValue({ id: 5725, planId: 1106 });
    mockPasture.update.mockResolvedValue({});

    await expect(
      PlanPastureController.update(baseReq({ planId: '1110', pastureId: '5725' }, { notes: 'x' }), buildRes()),
    ).rejects.toMatchObject({ code: 404 });
    expect(mockPasture.update).not.toHaveBeenCalled();
  });

  it('rejects updating an action that belongs to another plant community', async () => {
    const { default: PlanPastureController } = await import('../../src/router/controllers_v1/PlanPastureController.ts');

    mockPasture.findById.mockResolvedValue({ id: 5, planId: 1110 });
    mockPlantCommunity.findById.mockResolvedValue({ id: 9, pastureId: 5 });
    mockPlantCommunityAction.findById.mockResolvedValue({ id: 301, plantCommunityId: 2931 });
    mockPlantCommunityAction.update.mockResolvedValue({});

    await expect(
      PlanPastureController.updatePlantCommunityAction(
        baseReq({ planId: '1110', pastureId: '5', communityId: '9', actionId: '301' }, {}),
        buildRes(),
      ),
    ).rejects.toMatchObject({ code: 404 });
    expect(mockPlantCommunityAction.update).not.toHaveBeenCalled();
  });

  it('rejects updating an indicator plant that belongs to another plant community', async () => {
    const { default: PlanPastureController } = await import('../../src/router/controllers_v1/PlanPastureController.ts');

    mockPasture.findById.mockResolvedValue({ id: 5, planId: 1110 });
    mockPlantCommunity.findById.mockResolvedValue({ id: 9, pastureId: 5 });
    mockIndicatorPlant.findById.mockResolvedValue({ id: 101, plantCommunityId: 2931 });
    mockIndicatorPlant.update.mockResolvedValue({});

    await expect(
      PlanPastureController.updateIndicatorPlant(
        baseReq({ planId: '1110', pastureId: '5', communityId: '9', plantId: '101' }, {}),
        buildRes(),
      ),
    ).rejects.toMatchObject({ code: 404 });
    expect(mockIndicatorPlant.update).not.toHaveBeenCalled();
  });

  it('rejects updating a monitoring area that belongs to another plant community', async () => {
    const { default: PlanPastureController } = await import('../../src/router/controllers_v1/PlanPastureController.ts');

    mockPasture.findById.mockResolvedValue({ id: 5, planId: 1110 });
    mockPlantCommunity.findById.mockResolvedValue({ id: 9, pastureId: 5 });
    mockMonitoringArea.findById.mockResolvedValue({ id: 201, plantCommunityId: 2931 });
    mockMonitoringArea.update.mockResolvedValue({});

    await expect(
      PlanPastureController.updateMonitoringArea(
        baseReq({ planId: '1110', pastureId: '5', communityId: '9', areaId: '201' }, {}),
        buildRes(),
      ),
    ).rejects.toMatchObject({ code: 404 });
    expect(mockMonitoringArea.update).not.toHaveBeenCalled();
  });
});
