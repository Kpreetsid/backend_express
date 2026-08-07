import { Job, Worker } from 'bullmq';
import { queueConfig } from '../configDB';
import { applicationLogger } from '../observability/logger';
import {
  queueConsumerFailedCounter,
  queueConsumerProcessedCounter
} from '../observability/metrics';
import { QueueEventEnvelope } from './event-envelope';
import { getQueueConnectionOptions } from './queue-registry';
import {
  createTraceContext,
  runWithTraceContext
} from '../observability/trace-context';
import { redisKeys } from '../_config/redis-keys';

export type DomainEventHandler<TPayload = Record<string, unknown>> = (
  envelope: QueueEventEnvelope<TPayload>
) => Promise<void>;

const handlers = new Map<string, DomainEventHandler<any>>();
const terminalFailureHandlers = new Map<string, DomainEventHandler<any>>();
let worker: Worker | null = null;

const handlerKey = (type: string, version: number): string => `${type}@${version}`;

const requireEnvelope = (value: unknown): QueueEventEnvelope => {
  if (!value || typeof value !== 'object') throw new Error('Domain event envelope is required');
  const envelope = value as Partial<QueueEventEnvelope>;
  if (
    !envelope.eventId
    || !envelope.type
    || !Number.isSafeInteger(envelope.version)
    || Number(envelope.version) < 1
    || !envelope.tenantId
    || !envelope.correlationId
    || !envelope.entity?.type
    || !envelope.entity?.id
    || !envelope.timestamp
    || !envelope.payload
  ) {
    throw new Error('Domain event envelope is malformed');
  }
  return envelope as QueueEventEnvelope;
};

export const registerDomainEventHandler = <TPayload>(
  type: string,
  version: number,
  handler: DomainEventHandler<TPayload>
): void => {
  const key = handlerKey(type.trim(), version);
  if (!type.trim() || !Number.isSafeInteger(version) || version < 1) {
    throw new Error('Domain event handler type and positive version are required');
  }
  if (handlers.has(key)) throw new Error(`Domain event handler already registered: ${key}`);
  handlers.set(key, handler);
};

export const registerDomainEventTerminalFailureHandler = <TPayload>(
  type: string,
  version: number,
  handler: DomainEventHandler<TPayload>
): void => {
  const key = handlerKey(type.trim(), version);
  if (!type.trim() || !Number.isSafeInteger(version) || version < 1) {
    throw new Error('Terminal failure handler type and positive version are required');
  }
  if (terminalFailureHandlers.has(key)) {
    throw new Error(`Domain event terminal failure handler already registered: ${key}`);
  }
  terminalFailureHandlers.set(key, handler);
};

export const dispatchTerminalDomainEventFailure = async (
  value: unknown
): Promise<void> => {
  const envelope = requireEnvelope(value);
  const handler = terminalFailureHandlers.get(handlerKey(envelope.type, envelope.version));
  if (handler) {
    await runWithTraceContext(
      createTraceContext(envelope.correlationId),
      () => handler(envelope)
    );
  }
};

export const dispatchDomainEvent = async (value: unknown): Promise<void> => {
  const envelope = requireEnvelope(value);
  const key = handlerKey(envelope.type, envelope.version);
  const handler = handlers.get(key);
  if (!handler) throw new Error(`No domain event handler registered for ${key}`);
  await runWithTraceContext(
    createTraceContext(envelope.correlationId),
    () => handler(envelope)
  );
};

export const startDomainEventConsumer = (): Worker => {
  if (worker) return worker;
  if (!queueConfig.enabled) throw new Error('Queues are disabled');

  worker = new Worker(
    'domain-events',
    async (job: Job<QueueEventEnvelope>) => {
      await dispatchDomainEvent(job.data);
    },
    {
      connection: getQueueConnectionOptions(),
      prefix: redisKeys.queuePrefix(),
      concurrency: queueConfig.workerConcurrency
    }
  );

  worker.on('completed', (job) => {
    queueConsumerProcessedCounter.inc({ type: job.data.type });
    applicationLogger.info({
      eventId: job.data.eventId,
      eventType: job.data.type,
      eventVersion: job.data.version,
      tenantId: job.data.tenantId,
      correlationId: job.data.correlationId,
      jobId: job.id
    }, 'Domain event processed');
  });

  worker.on('failed', (job, error) => {
    const type = job?.data?.type || 'unknown';
    queueConsumerFailedCounter.inc({ type });
    applicationLogger.error({
      err: error,
      eventId: job?.data?.eventId,
      eventType: type,
      eventVersion: job?.data?.version,
      tenantId: job?.data?.tenantId,
      correlationId: job?.data?.correlationId,
      jobId: job?.id,
      attemptsMade: job?.attemptsMade
    }, 'Domain event processing failed');
    const configuredAttempts = Number(job?.opts.attempts || 1);
    if (job && job.attemptsMade >= configuredAttempts) {
      void dispatchTerminalDomainEventFailure(job.data).catch((terminalError) => {
        applicationLogger.error({
          err: terminalError,
          eventId: job.data.eventId,
          eventType: type,
          eventVersion: job.data.version,
          tenantId: job.data.tenantId,
          correlationId: job.data.correlationId,
          jobId: job.id
        }, 'Domain event terminal failure handler failed');
      });
    }
  });

  return worker;
};

export const closeDomainEventConsumer = async (): Promise<void> => {
  const activeWorker = worker;
  worker = null;
  if (activeWorker) await activeWorker.close();
};
