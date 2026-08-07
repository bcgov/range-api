import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/libs/db2/model/amendmenttype.js', () => ({
  default: {
    find: vi.fn().mockResolvedValue([
      { id: 1, description: 'Minor Amendment' },
      { id: 2, description: 'Mandatory Amendment' },
    ]),
  },
}));

describe('PlanSnapshot.fetchAmendmentSubmissions', () => {
  it('pairs a mandatory amendment with its later approval', async () => {
    const snapshots = [
      {
        id: 1,
        plan_id: 1444,
        version: 1,
        status_id: 12,
        created_at: '2021-06-17T23:43:07.837Z',
        snapshot: { statusId: 12, amendmentTypeId: null },
        given_name: 'Jason',
        family_name: 'Caswell',
      },
      {
        id: 2,
        plan_id: 1444,
        version: 2,
        status_id: 22,
        created_at: '2024-02-22T23:38:15.337Z',
        snapshot: { statusId: 22, amendmentTypeId: 2 },
        given_name: 'Taylor',
        family_name: 'Grafton',
      },
      {
        id: 3,
        plan_id: 1444,
        version: 3,
        status_id: 12,
        created_at: '2024-05-30T23:00:48.697Z',
        snapshot: { statusId: 12, amendmentTypeId: 2 },
        given_name: 'Tara',
        family_name: 'Bogh',
      },
    ];
    const query = {
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(snapshots),
    };
    const db = { selectFrom: vi.fn().mockReturnValue(query) };
    const { default: PlanSnapshot } = await import('../../src/libs/db2/model/plansnapshot.ts');

    const result = await PlanSnapshot.fetchAmendmentSubmissions(db, 1444);

    expect(result[1]).toMatchObject({
      createdAt: '2024-02-22T23:38:15.337Z',
      submittedBy: 'Taylor Grafton',
      approvedAt: '2024-05-30T23:00:48.697Z',
      approvedBy: 'Tara Bogh',
    });
    expect(result[1].isCurrentLegalVersion).toBe(true);
  });
});
