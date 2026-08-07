import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OutboxEventModel } from '../models/outboxEvent.model';
import { createOutboxEvent } from './outbox-writer';

vi.mock('../models/outboxEvent.model', () => ({
  OutboxEventModel: {
    create: vi.fn()
  }
}));

describe('outbox writer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(OutboxEventModel.create).mockResolvedValue([] as never);
  });

  it('writes a versioned, tenant-scoped event with the mutation session', async () => {
    const session = { id: 'transaction-session' };
    const envelope = await createOutboxEvent(
      {
        eventId: 'event-1',
        type: 'work-order.created',
        version: 2,
        tenantId: 'tenant-1',
        actorId: 'user-1',
        correlationId: 'request-1',
        entity: { type: 'work-order', id: 'wo-1' },
        timestamp: '2026-07-28T00:00:00.000Z',
        payload: { priority: 'high' }
      },
      { session: session as never }
    );

    expect(envelope).toEqual({
      eventId: 'event-1',
      type: 'work-order.created',
      version: 2,
      tenantId: 'tenant-1',
      actorId: 'user-1',
      correlationId: 'request-1',
      entity: { type: 'work-order', id: 'wo-1' },
      timestamp: '2026-07-28T00:00:00.000Z',
      payload: { priority: 'high' }
    });
    expect(OutboxEventModel.create).toHaveBeenCalledWith(
      [{ ...envelope, status: 'pending', attempts: 0 }],
      { session }
    );
  });

  it('creates safe defaults when optional envelope fields are omitted', async () => {
    const envelope = await createOutboxEvent({
      type: 'notification.created',
      tenantId: 'tenant-1',
      correlationId: 'request-2',
      entity: { type: 'notification', id: 'notification-1' },
      payload: {}
    });

    expect(envelope.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(envelope.version).toBe(1);
    expect(envelope.timestamp).toMatch(/Z$/);
    expect(OutboxEventModel.create).toHaveBeenCalledWith(
      [{ ...envelope, status: 'pending', attempts: 0 }],
      undefined
    );
  });

  it.each([
    [{ type: '', tenantId: 'tenant', correlationId: 'request', entity: { type: 'asset', id: '1' }, payload: {} }, 'type is required'],
    [{ type: 'asset.created', tenantId: '', correlationId: 'request', entity: { type: 'asset', id: '1' }, payload: {} }, 'tenantId is required'],
    [{ type: 'asset.created', tenantId: 'tenant', correlationId: '', entity: { type: 'asset', id: '1' }, payload: {} }, 'correlationId is required'],
    [{ type: 'asset.created', tenantId: 'tenant', correlationId: 'request', entity: { type: '', id: '1' }, payload: {} }, 'entity.type is required']
  ])('rejects malformed envelopes before persistence', async (input, message) => {
    await expect(createOutboxEvent(input)).rejects.toThrow(message);
    expect(OutboxEventModel.create).not.toHaveBeenCalled();
  });
});
