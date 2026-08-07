import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/libs/db2/model/agreement.js', () => ({ default: {} }));

describe('formatPlanVersionDates', () => {
  it('uses the BC timezone for dates near UTC midnight', async () => {
    const { formatPlanVersionDates } = await import('../../src/router/helpers/PDFHelper.ts');

    const plan = {
      originalApproval: { date: '2024-03-16T06:30:00.000Z' },
      amendmentSubmissions: [
        {
          createdAt: '2024-03-16T06:30:00.000Z',
          approvedAt: '2024-03-16T07:30:00.000Z',
        },
      ],
    };

    expect(formatPlanVersionDates(plan)).toEqual({
      originalApproval: { date: '2024-03-15' },
      amendmentSubmissions: [{ createdAt: '2024-03-15', approvedAt: '2024-03-16' }],
    });
  });
});
