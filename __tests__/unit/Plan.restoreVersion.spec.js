import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regression test for the "schedule entry dates must be within schedule year"
 * bug reaching production data via Plan.restoreVersion().
 *
 * restoreVersion() re-creates grazing/hay-cutting schedule entries straight
 * from a historical plan_snapshot JSON blob via GrazingScheduleEntry.create()
 * / HayCuttingScheduleEntry.create(), bypassing the validateEntryDates() guard
 * that PlanScheduleController.store()/update() apply. If an old snapshot
 * (taken before that guard existed) contains an entry whose dateIn year
 * doesn't match its schedule's year, restoring that snapshot silently
 * reintroduces the bad data.
 */

const { mockGrazingScheduleEntry, mockHayCuttingScheduleEntry, mockSchedule, mockPlanSnapshot, others } = vi.hoisted(
  () => {
    const grazingEntry = { remove: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({}) };
    const hayCuttingEntry = { remove: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({}) };
    const schedule = {
      remove: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(async (_db, values) => ({ id: values.id, year: values.year })),
      scheduleEntryCreators: {},
    };
    const planSnapshot = { findOne: vi.fn() };
    const noop = () => ({ remove: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({}) });
    return {
      mockGrazingScheduleEntry: grazingEntry,
      mockHayCuttingScheduleEntry: hayCuttingEntry,
      mockSchedule: schedule,
      mockPlanSnapshot: planSnapshot,
      others: {
        pasture: noop(),
        plantCommunity: noop(),
        indicatorPlant: noop(),
        monitoringArea: noop(),
        monitoringAreaPurpose: noop(),
        plantCommunityAction: noop(),
        additionalRequirement: noop(),
        ministerIssue: noop(),
        ministerIssueAction: noop(),
        ministerIssuePasture: noop(),
        managementConsideration: noop(),
        planConfirmation: noop(),
        invasivePlantChecklist: noop(),
        planStatusHistory: noop(),
        planFile: noop(),
      },
    };
  },
);

vi.mock('../../src/libs/db2/model/pasture.js', () => ({ default: others.pasture }));
vi.mock('../../src/libs/db2/model/plantcommunity.js', () => ({ default: others.plantCommunity }));
vi.mock('../../src/libs/db2/model/indicatorplant.js', () => ({ default: others.indicatorPlant }));
vi.mock('../../src/libs/db2/model/monitoringarea.js', () => ({ default: others.monitoringArea }));
vi.mock('../../src/libs/db2/model/monitoringareapurpose.js', () => ({ default: others.monitoringAreaPurpose }));
vi.mock('../../src/libs/db2/model/plantcommunityaction.js', () => ({ default: others.plantCommunityAction }));
vi.mock('../../src/libs/db2/model/grazingschedule.js', () => ({ default: mockSchedule }));
vi.mock('../../src/libs/db2/model/grazingscheduleentry.js', () => ({ default: mockGrazingScheduleEntry }));
vi.mock('../../src/libs/db2/model/haycuttingscheduleentry.js', () => ({ default: mockHayCuttingScheduleEntry }));
vi.mock('../../src/libs/db2/model/additionalrequirement.js', () => ({ default: others.additionalRequirement }));
vi.mock('../../src/libs/db2/model/ministerissue.js', () => ({ default: others.ministerIssue }));
vi.mock('../../src/libs/db2/model/ministerissueaction.js', () => ({ default: others.ministerIssueAction }));
vi.mock('../../src/libs/db2/model/ministerissuepasture.js', () => ({ default: others.ministerIssuePasture }));
vi.mock('../../src/libs/db2/model/managementconsideration.js', () => ({ default: others.managementConsideration }));
vi.mock('../../src/libs/db2/model/planconfirmation.js', () => ({ default: others.planConfirmation }));
vi.mock('../../src/libs/db2/model/invasiveplantchecklist.js', () => ({ default: others.invasivePlantChecklist }));
vi.mock('../../src/libs/db2/model/planstatushistory.js', () => ({ default: others.planStatusHistory }));
vi.mock('../../src/libs/db2/model/PlanFile.js', () => ({ default: others.planFile }));
vi.mock('../../src/libs/db2/model/plansnapshot.js', () => ({ default: mockPlanSnapshot }));

function makeChain(executeResult) {
  const chain = {
    selectAll: () => chain,
    select: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    set: () => chain,
    values: () => chain,
    returning: () => chain,
    execute: async () => executeResult,
  };
  return chain;
}

// Fake kysely-ish db: only Plan.update()/Plan.findById() (real, unmocked
// KyselyModel logic) touch this — every other model above is mocked out.
const fakeDb = {
  updateTable: () => makeChain([1]),
  selectFrom: () => makeChain([{ id: 1312, agreement_id: 'RAN074721', status_id: 21 }]),
  insertInto: () => makeChain([1]),
  deleteFrom: () => makeChain([]),
};

describe('Plan.restoreVersion — schedule entry year validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSchedule.scheduleEntryCreators = { 1: mockGrazingScheduleEntry, 2: mockHayCuttingScheduleEntry };
  });

  const baseSnapshot = {
    id: 1312,
    agreement: { agreementTypeId: 1 },
    pastures: [],
    additionalRequirements: [],
    ministerIssues: [],
    managementConsiderations: [],
    confirmations: [],
    invasivePlantChecklist: null,
    planStatusHistory: [],
    files: [],
    schedules: [
      {
        id: 3231,
        year: 2022,
        scheduleEntries: [
          // Bad legacy data: dateIn is year 2021, but this schedule is year 2022.
          { id: 12537, dateIn: '2021-06-01T07:00:00.000Z', dateOut: '2021-09-30T07:00:00.000Z', pastureId: 3067 },
        ],
      },
    ],
  };

  it('rejects restoring a snapshot whose schedule entries do not match their schedule year', async () => {
    mockPlanSnapshot.findOne.mockResolvedValue({ snapshot: baseSnapshot });
    const { default: Plan } = await import('../../src/libs/db2/model/plan.ts');

    await expect(Plan.restoreVersion(fakeDb, 1312, 12)).rejects.toThrow(
      /schedule entry date.*must be within.*schedule year/i,
    );

    // The bad entry must never reach the database.
    expect(mockGrazingScheduleEntry.create).not.toHaveBeenCalled();
  });

  it('restores normally when schedule entry dates match their schedule year', async () => {
    const validSnapshot = {
      ...baseSnapshot,
      schedules: [
        {
          id: 3231,
          year: 2022,
          scheduleEntries: [
            { id: 12537, dateIn: '2022-06-01T07:00:00.000Z', dateOut: '2022-09-30T07:00:00.000Z', pastureId: 3067 },
          ],
        },
      ],
    };
    mockPlanSnapshot.findOne.mockResolvedValue({ snapshot: validSnapshot });
    const { default: Plan } = await import('../../src/libs/db2/model/plan.ts');

    await expect(Plan.restoreVersion(fakeDb, 1312, 12)).resolves.not.toThrow();
    expect(mockGrazingScheduleEntry.create).toHaveBeenCalledTimes(1);
  });
});
