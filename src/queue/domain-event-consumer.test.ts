import { afterEach, describe, expect, it, vi } from 'vitest';
import { queueConfig } from '../configDB';
import {
  closeDomainEventConsumer,
  dispatchTerminalDomainEventFailure,
  dispatchDomainEvent,
  registerDomainEventHandler,
  registerDomainEventTerminalFailureHandler,
  startDomainEventConsumer
} from './domain-event-consumer';

const workerHarness = vi.hoisted(() => ({
  instances: [] as Array<{
    processor: (job: any) => Promise<void>;
    handlers: Record<string, (...args: any[]) => void>;
    close: ReturnType<typeof vi.fn>;
  }>
}));

vi.mock('bullmq', () => ({
  Worker: class {
    processor: (job: any) => Promise<void>;
    handlers: Record<string, (...args: any[]) => void> = {};
    close = vi.fn().mockResolvedValue(undefined);

    constructor(_name: string, processor: (job: any) => Promise<void>) {
      this.processor = processor;
      workerHarness.instances.push(this);
    }

    on(event: string, handler: (...args: any[]) => void) {
      this.handlers[event] = handler;
      return this;
    }
  }
}));

vi.mock('./queue-registry', () => ({
  getQueueConnectionOptions: vi.fn(() => ({ host: 'redis.test', port: 6379 }))
}));

const envelope = (type: string, version = 1) => ({
  eventId: `event-${type}`,
  type,
  version,
  tenantId: 'tenant-1',
  actorId: 'user-1',
  correlationId: 'request-1',
  entity: { type: 'work-order', id: 'wo-1' },
  timestamp: '2026-07-28T00:00:00.000Z',
  payload: { value: 1 }
});

describe('domain event consumer registry', () => {
  const originalQueueEnabled = queueConfig.enabled;

  afterEach(async () => {
    await closeDomainEventConsumer();
    queueConfig.enabled = originalQueueEnabled;
    workerHarness.instances.length = 0;
  });

  it('dispatches only to the exact type and version handler', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registerDomainEventHandler('test.work-order.created', 2, handler);

    await dispatchDomainEvent(envelope('test.work-order.created', 2));

    expect(handler).toHaveBeenCalledWith(envelope('test.work-order.created', 2));
  });

  it('rejects unknown event versions so BullMQ can retry and dead-letter them', async () => {
    await expect(dispatchDomainEvent(envelope('test.unknown', 9)))
      .rejects.toThrow('No domain event handler registered for test.unknown@9');
  });

  it.each([
    null,
    {},
    { type: 'test.event', version: 1 }
  ])('rejects malformed envelopes before invoking business handlers', async (value) => {
    await expect(dispatchDomainEvent(value)).rejects.toThrow('Domain event envelope');
  });

  it('prevents ambiguous duplicate handler registration', () => {
    registerDomainEventHandler('test.unique', 1, vi.fn());
    expect(() => registerDomainEventHandler('test.unique', 1, vi.fn()))
      .toThrow('already registered');
  });

  it('dispatches an exhausted job to its exact terminal-failure handler', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registerDomainEventTerminalFailureHandler('test.terminal', 1, handler);
    await dispatchTerminalDomainEventFailure(envelope('test.terminal'));
    expect(handler).toHaveBeenCalledWith(envelope('test.terminal'));
  });

  it('starts one configured worker, processes jobs, records lifecycle events and closes cleanly', async () => {
    queueConfig.enabled = true;
    const handler = vi.fn().mockResolvedValue(undefined);
    const terminalHandler = vi.fn().mockResolvedValue(undefined);
    registerDomainEventHandler('test.lifecycle', 1, handler);
    registerDomainEventTerminalFailureHandler('test.lifecycle', 1, terminalHandler);

    const first = startDomainEventConsumer();
    const second = startDomainEventConsumer();
    const instance = workerHarness.instances[0]!;

    expect(second).toBe(first);
    expect(workerHarness.instances).toHaveLength(1);
    await instance.processor({ data: envelope('test.lifecycle') });
    expect(handler).toHaveBeenCalledTimes(1);

    instance.handlers['completed']?.({
      id: 'job-1',
      data: envelope('test.lifecycle')
    });
    instance.handlers['failed']?.({
      id: 'job-1',
      data: envelope('test.lifecycle'),
      attemptsMade: 1,
      opts: { attempts: 1 }
    }, new Error('retry'));
    await vi.waitFor(() => expect(terminalHandler).toHaveBeenCalledTimes(1));

    await closeDomainEventConsumer();
    expect(instance.close).toHaveBeenCalledTimes(1);
  });

  it('refuses to start a worker when queues are disabled', () => {
    queueConfig.enabled = false;
    expect(() => startDomainEventConsumer()).toThrow('Queues are disabled');
  });
});
