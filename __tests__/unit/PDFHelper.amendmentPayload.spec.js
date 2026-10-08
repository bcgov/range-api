import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/libs/db2/model/agreement.js', () => ({ default: {} }));

const { selectOriginalApproval, selectAmendmentTableRows } = await import('../../src/router/helpers/PDFHelper.ts');

// Shaped like PlanSnapshot.fetchAmendmentSubmissions output for RAN077582:
// V10 original approval followed by the still-unapproved V11 mandatory amendment.
const originalApprovalEntry = {
  version: 10,
  createdAt: null,
  submittedBy: null,
  approvedAt: '2023-05-11T23:25:14.434Z',
  approvedBy: 'DM Approver',
  amendmentType: null,
};

const pendingMandatoryEntry = {
  version: 11,
  createdAt: '2024-04-10T21:33:11.477Z',
  submittedBy: 'Submitting Staff',
  approvedAt: null,
  approvedBy: null,
  amendmentType: 'Mandatory Amendment',
};

describe('selectOriginalApproval', () => {
  it('uses the earliest approval when a later amendment is still unapproved', () => {
    expect(selectOriginalApproval([originalApprovalEntry, pendingMandatoryEntry])).toBe(originalApprovalEntry);
  });

  it('returns null when nothing has been approved yet', () => {
    expect(selectOriginalApproval([pendingMandatoryEntry])).toBeNull();
    expect(selectOriginalApproval([])).toBeNull();
    expect(selectOriginalApproval(null)).toBeNull();
  });
});

describe('selectAmendmentTableRows', () => {
  it('excludes the original approval so it does not render as a phantom amendment', () => {
    expect(selectAmendmentTableRows([originalApprovalEntry, pendingMandatoryEntry])).toEqual([pendingMandatoryEntry]);
  });

  it('keeps real amendment rows including extensions', () => {
    const extensionEntry = { ...pendingMandatoryEntry, amendmentType: 'Extension' };
    expect(selectAmendmentTableRows([originalApprovalEntry, extensionEntry])).toEqual([extensionEntry]);
  });

  it('returns an empty table when the plan was never amended', () => {
    expect(selectAmendmentTableRows([originalApprovalEntry])).toEqual([]);
  });
});
