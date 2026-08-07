import { beforeEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { MailerService } from './mailer';

const mailHarness = vi.hoisted(() => ({
  verify: vi.fn(),
  sendMail: vi.fn(),
  exists: vi.fn(),
  createMailLog: vi.fn()
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      verify: mailHarness.verify,
      sendMail: mailHarness.sendMail
    }))
  }
}));

vi.mock('../models/mailLog.model', () => ({
  MailLogModel: class {
    static exists = mailHarness.exists;
    constructor(data: Record<string, unknown>) {
      Object.assign(this, data);
    }
  },
  createMailLog: mailHarness.createMailLog
}));

vi.mock('./auth', () => ({
  generateExternalAccessToken: vi.fn(() => 'external-token')
}));

const workOrder = {
  _id: 'wo-1',
  order_no: 'WO-1',
  title: 'Inspect pump',
  description: 'Inspect the pump',
  status: 'Open',
  priority: 'High',
  parts: [],
  procedure_entries: []
};
const recipient = {
  _id: 'user-1',
  account_id: 'tenant-1',
  firstName: 'Assigned',
  lastName: 'User',
  email: 'assigned@example.test'
};
const creator = {
  firstName: 'Creating',
  lastName: 'User'
};

describe('mailer delivery idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mailHarness.verify.mockResolvedValue(true);
    mailHarness.sendMail.mockResolvedValue({
      messageId: '<provider-id>',
      accepted: [recipient.email],
      rejected: [],
      response: 'accepted'
    });
    mailHarness.createMailLog.mockResolvedValue({});
  });

  it('keeps SMTP certificate verification enabled', () => {
    new MailerService();

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        tls: { rejectUnauthorized: true }
      })
    );
  });

  it('skips a BullMQ retry when the deterministic message id is already successful', async () => {
    mailHarness.exists.mockResolvedValue({ _id: 'mail-log-1' });
    const mailer = new MailerService();

    await mailer.sendWorkOrderMail(
      workOrder,
      recipient,
      creator,
      '<event-1.user-1@cmms.work-order>'
    );

    expect(mailHarness.exists).toHaveBeenCalledWith({
      messageId: '<event-1.user-1@cmms.work-order>',
      status: 'success'
    });
    expect(mailHarness.sendMail).not.toHaveBeenCalled();
  });

  it('sends and records the deterministic message id on first delivery', async () => {
    mailHarness.exists.mockResolvedValue(null);
    const mailer = new MailerService();

    await mailer.sendWorkOrderMail(
      workOrder,
      recipient,
      creator,
      '<event-1.user-1@cmms.work-order>'
    );

    expect(mailHarness.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: recipient.email,
      messageId: '<event-1.user-1@cmms.work-order>'
    }));
    expect(mailHarness.createMailLog).toHaveBeenCalledWith(expect.objectContaining({
      messageId: '<event-1.user-1@cmms.work-order>',
      status: 'success'
    }));
  });
});
