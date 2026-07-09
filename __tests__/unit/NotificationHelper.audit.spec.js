import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockMailerSendEmail, mockWriteDomainAudit, mockFindTemplate } = vi.hoisted(() => ({
  mockMailerSendEmail: vi.fn(),
  mockWriteDomainAudit: vi.fn().mockResolvedValue(undefined),
  mockFindTemplate: vi.fn(),
}));

vi.mock('../../src/libs/mailer.js', () => ({
  Mailer: class MailerMock {
    sendEmail = mockMailerSendEmail;
  },
}));

vi.mock('../../src/libs/audit.js', () => ({
  writeDomainAudit: mockWriteDomainAudit,
}));

vi.mock('../../src/libs/db2/model/emailtemplate.js', () => ({
  default: {
    findWithExclusion: mockFindTemplate,
  },
}));

describe('NotificationHelper email audit events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindTemplate.mockResolvedValue([
      {
        fromEmail: 'no-reply@test.ca',
        subject: 'Subject',
        body: 'Body',
      },
    ]);
    mockMailerSendEmail.mockResolvedValue(undefined);
  });

  it('writes notification.email.sent when email delivery succeeds', async () => {
    const { default: NotificationHelper } = await import('../../src/router/helpers/NotificationHelper.ts');

    await NotificationHelper.sendEmail({}, ['to@test.ca'], 'Response Required', { '{agreementId}': 'RAN076843' });

    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        action: 'notification.email.sent',
        entityType: 'notification',
        entityId: 'Response Required',
      }),
    );
  });

  it('writes notification.email.failed with template_missing when template is absent', async () => {
    const { default: NotificationHelper } = await import('../../src/router/helpers/NotificationHelper.ts');
    mockFindTemplate.mockResolvedValue([]);

    await expect(NotificationHelper.sendEmail({}, ['to@test.ca'], 'Missing Template', {})).rejects.toThrow(
      'Email template Missing Template not found',
    );

    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        action: 'notification.email.failed',
        metadata: expect.objectContaining({
          reason: 'template_missing',
        }),
      }),
    );
  });

  it('writes notification.email.failed with delivery_failed when mail send fails', async () => {
    const { default: NotificationHelper } = await import('../../src/router/helpers/NotificationHelper.ts');
    mockMailerSendEmail.mockRejectedValue(new Error('smtp timeout'));

    await expect(NotificationHelper.sendEmail({}, ['to@test.ca'], 'Response Required', {})).rejects.toThrow(
      'smtp timeout',
    );

    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        action: 'notification.email.failed',
        metadata: expect.objectContaining({
          reason: 'delivery_failed',
        }),
      }),
    );
  });

  it('writes notification.email.failed with no_recipients when recipient list is empty', async () => {
    const { default: NotificationHelper } = await import('../../src/router/helpers/NotificationHelper.ts');

    await NotificationHelper.sendEmail({}, [], 'Response Required', {});

    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        action: 'notification.email.failed',
        metadata: expect.objectContaining({
          reason: 'no_recipients',
          recipientCount: 0,
        }),
      }),
    );
    expect(mockMailerSendEmail).not.toHaveBeenCalled();
  });

  it('handles null attachments without masking send errors', async () => {
    const { default: NotificationHelper } = await import('../../src/router/helpers/NotificationHelper.ts');
    mockMailerSendEmail.mockRejectedValue(new Error('smtp timeout'));

    await expect(NotificationHelper.sendEmail({}, ['to@test.ca'], 'Response Required', {}, null)).rejects.toThrow(
      'smtp timeout',
    );

    expect(mockWriteDomainAudit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        action: 'notification.email.failed',
        metadata: expect.objectContaining({
          hasAttachments: false,
          reason: 'delivery_failed',
        }),
      }),
    );
  });
});
