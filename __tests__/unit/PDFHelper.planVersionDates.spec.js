import { describe, expect, it } from 'vitest';
import { formatPlanVersionDates } from '../../src/router/helpers/PDFHelper.ts';

describe('formatPlanVersionDates', () => {
  it('uses the BC timezone for dates near UTC midnight', () => {
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
