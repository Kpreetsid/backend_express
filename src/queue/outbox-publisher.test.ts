import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queueConfig } from '../configDB';
import { OutboxEventModel } from '../models/outboxEvent.model';
import { enqueueEvent } from './queue-registry';
import {
  publishPendingOutboxEvents,
  redriveDeadLetterEvent
} from './outbox-publisher';

vi.mock('../models/outboxEvent.model', () => ({
  OutboxEventModel: {
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn()
  }
}));

vi.mock('./queue-registry', () => ({
  enqueueEvent: vi.fn()
}));

const baseEvent = {
  _id: 'mongo-id-1',
  eventId: 'event-1',
  type: 'notification.created',
  version: 1,
  tenantId: 'tenant-1',
  actorId: 'user-1',
  correlationId: 'request-1',
  entity: { type: 'notification', id: 'notification-1' },
  timestamp: '2026-07-28T00:00:00.000Z',
  payload: { notificationId: 'notification-1' },
  attempts: 1
};

describe('outbox publisher', () => {
  const originalMaxAttempts = queueConfig.outboxMaxAttempts;

  beforeEach(() => {
    vi.clearAllMocks();
    queueConfig.outboxMaxAttempts = 3;
    vi.mocked(OutboxEventModel.findOneAndUpdate)
      .mockResolvedValueOnce(baseEvent as never)
      .mockResolvedValueOnce(null);
    vi.mocked(OutboxEventModel.updateOne).mockResolvedValue({ acknowledged: true } as never);
  });

  afterEach(() => {
    queueConfig.outboxMaxAttempts = originalMaxAttempts;
  });

  it('publishes a versioned event and marks the outbox record complete', async () => {
    vi.mocked(enqueueEvent).mockResolvedValue();

    await expect(publishPendingOutboxEvents()).resolves.toBe(1);

    expect(enqueueEvent).toHaveBeenCalledWith(
      'domain-events',
      expect.objectContaining({
        eventId: 'event-1',
        version: 1,
        tenantId: 'tenant-1',
        correlationId: 'request-1'
      })
    );
    expect(OutboxEventModel.updateOne).toHaveBeenCalledWith(
      { _id: 'mongo-id-1', status: 'processing' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'published' })
      })
    );
  });

  it('schedules a bounded exponential retry before the attempt limit', async () => {
    vi.mocked(enqueueEvent).mockRejectedValue(new Error('Redis unavailable'));

    await expect(publishPendingOutboxEvents()).resolves.toBe(0);

    expect(OutboxEventModel.updateOne).toHaveBeenCalledWith(
      { _id: 'mongo-id-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'failed',
          lastError: 'Redis unavailable',
          nextAttemptAt: expect.any(Date)
        })
      })
    );
  });

  it('moves exhausted events to a terminal dead-letter state', async () => {
    queueConfig.outboxMaxAttempts = 1;
    vi.mocked(enqueueEvent).mockRejectedValue(new Error('Permanent failure'));

    await expect(publishPendingOutboxEvents()).resolves.toBe(0);

    expect(OutboxEventModel.updateOne).toHaveBeenCalledWith(
      { _id: 'mongo-id-1' },
      {
        $set: {
          status: 'dead-letter',
          lastError: 'Permanent failure',
          deadLetteredAt: expect.any(Date)
        },
        $unset: { nextAttemptAt: '' }
      }
    );
  });

  it('redrives only a matching tenant-scoped dead-letter event', async () => {
    vi.mocked(OutboxEventModel.updateOne).mockResolvedValue({
      acknowledged: true,
      modifiedCount: 1
    } as never);

    await expect(redriveDeadLetterEvent('event-1', 'tenant-1')).resolves.toBe(true);

    expect(OutboxEventModel.updateOne).toHaveBeenCalledWith(
      {
        eventId: 'event-1',
        tenantId: 'tenant-1',
        status: 'dead-letter'
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'pending',
          attempts: 0,
          nextAttemptAt: expect.any(Date)
        })
      })
    );
  });
});
