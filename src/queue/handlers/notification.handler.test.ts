import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationService } from '../../utils/notification.service';
import { registerDomainEventHandler } from '../domain-event-consumer';
import {
  handleAccountNotification,
  registerNotificationHandlers
} from './notification.handler';

vi.mock('../../utils/notification.service', () => ({
  notificationService: {
    notifyAccountUsers: vi.fn()
  }
}));

vi.mock('../domain-event-consumer', () => ({
  registerDomainEventHandler: vi.fn()
}));

const envelope = {
  eventId: 'event-1',
  type: 'notification.account.requested',
  version: 1,
  tenantId: 'tenant-1',
  actorId: 'user-1',
  correlationId: 'request-1',
  entity: { type: 'work-order', id: 'wo-1' },
  timestamp: '2026-07-28T00:00:00.000Z',
  payload: {
    accountId: 'tenant-1',
    module: 'Work Order',
    event: 'created' as const,
    entityId: 'wo-1',
    actionUrl: '/work-order/details/wo-1'
  }
};

describe('notification domain-event handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delivers an idempotent account notification using the event id', async () => {
    vi.mocked(notificationService.notifyAccountUsers).mockResolvedValue();

    await handleAccountNotification(envelope);

    expect(notificationService.notifyAccountUsers)
      .toHaveBeenCalledWith(envelope.payload, 'event-1');
  });

  it('rejects cross-tenant payloads before notification persistence', async () => {
    await expect(handleAccountNotification({
      ...envelope,
      payload: { ...envelope.payload, accountId: 'tenant-2' }
    })).rejects.toThrow('tenant');
    expect(notificationService.notifyAccountUsers).not.toHaveBeenCalled();
  });

  it('rejects malformed payloads for retry/dead-letter handling', async () => {
    await expect(handleAccountNotification({
      ...envelope,
      payload: { accountId: 'tenant-1' }
    })).rejects.toThrow('malformed');
  });

  it('registers the exact notification event contract', () => {
    registerNotificationHandlers();
    expect(registerDomainEventHandler).toHaveBeenCalledWith(
      'notification.account.requested',
      1,
      handleAccountNotification
    );
  });
});
