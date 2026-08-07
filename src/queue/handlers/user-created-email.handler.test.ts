import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserModel } from '../../models/user.model';
import { registerDomainEventHandler } from '../domain-event-consumer';
import {
  handleUserCreatedEmail,
  registerUserCreatedEmailHandlers
} from './user-created-email.handler';

const mailHarness = vi.hoisted(() => ({
  sendUserCreatedMail: vi.fn()
}));

vi.mock('../../_config/mailer', () => ({
  MailerService: vi.fn(function () {
    return mailHarness;
  })
}));

vi.mock('../../models/user.model', () => ({
  UserModel: { findOne: vi.fn() }
}));

vi.mock('../domain-event-consumer', () => ({
  registerDomainEventHandler: vi.fn()
}));

const envelope = {
  eventId: 'event-1',
  type: 'email.user.created',
  version: 1,
  tenantId: 'tenant-1',
  actorId: 'creator-1',
  correlationId: 'request-1',
  entity: { type: 'user', id: 'user-1' },
  timestamp: '2026-07-28T00:00:00.000Z',
  payload: { userId: 'user-1' }
};

describe('user-created email domain-event handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(UserModel.findOne).mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: 'user-1',
        account_id: 'tenant-1',
        username: 'new.user',
        email: 'new.user@example.test'
      })
    } as never);
    mailHarness.sendUserCreatedMail.mockResolvedValue(undefined);
  });

  it('loads the recipient through the envelope tenant and uses a deterministic message id', async () => {
    await handleUserCreatedEmail(envelope);

    expect(UserModel.findOne).toHaveBeenCalledWith({
      _id: 'user-1',
      account_id: 'tenant-1',
      user_status: 'active'
    });
    expect(mailHarness.sendUserCreatedMail).toHaveBeenCalledWith(
      { userName: 'new.user', userEmail: 'new.user@example.test' },
      '<event-1.user-1@cmms.user-created>'
    );
  });

  it('fails safely when the tenant-scoped recipient cannot be resolved', async () => {
    vi.mocked(UserModel.findOne).mockReturnValue({
      select: vi.fn().mockResolvedValue(null)
    } as never);

    await expect(handleUserCreatedEmail(envelope))
      .rejects.toThrow('recipient is unavailable');
    expect(mailHarness.sendUserCreatedMail).not.toHaveBeenCalled();
  });

  it('rejects malformed payloads before querying user data', async () => {
    await expect(handleUserCreatedEmail({
      ...envelope,
      payload: {}
    })).rejects.toThrow('malformed');
    expect(UserModel.findOne).not.toHaveBeenCalled();
  });

  it('registers the exact user-created email event contract', () => {
    registerUserCreatedEmailHandlers();
    expect(registerDomainEventHandler).toHaveBeenCalledWith(
      'email.user.created',
      1,
      handleUserCreatedEmail
    );
  });
});
