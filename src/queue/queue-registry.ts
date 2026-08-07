import { JobsOptions, Queue } from 'bullmq';
import { queueConfig, redisConfig } from '../configDB';
import { QueueEventEnvelope } from './event-envelope';
import { redisKeys } from '../_config/redis-keys';

const queues = new Map<string, Queue>();

export interface QueueReadiness {
  status: 'disabled' | 'connected' | 'unavailable';
  counts: {
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
  };
}

export const getQueueConnectionOptions = () => {
  if (!redisConfig.url) throw new Error('REDIS_URL is required when queues are enabled');
  const url = new URL(redisConfig.url);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    connectTimeout: redisConfig.connectTimeoutMs,
    maxRetriesPerRequest: null
  };
};

export const getQueue = (name: string): Queue => {
  if (!queueConfig.enabled) throw new Error('Queues are disabled');
  const registered = queues.get(name);
  if (registered) return registered;

  const queue = new Queue(name, {
    connection: getQueueConnectionOptions(),
    prefix: redisKeys.queuePrefix()
  });
  queues.set(name, queue);
  return queue;
};

export const enqueueEvent = async <TPayload>(
  queueName: string,
  envelope: QueueEventEnvelope<TPayload>,
  overrides: JobsOptions = {}
): Promise<void> => {
  await getQueue(queueName).add(envelope.type, envelope, {
    jobId: envelope.eventId,
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 24 * 60 * 60, count: 10_000 },
    removeOnFail: false,
    ...overrides
  });
};

export const closeQueues = async (): Promise<void> => {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();
};

export const checkQueueReadiness = async (): Promise<QueueReadiness> => {
  const emptyCounts = { waiting: 0, active: 0, delayed: 0, failed: 0 };
  if (!queueConfig.enabled) {
    return { status: 'disabled', counts: emptyCounts };
  }

  try {
    const counts = await getQueue('domain-events').getJobCounts(
      'waiting',
      'active',
      'delayed',
      'failed'
    );
    return {
      status: 'connected',
      counts: {
        waiting: counts['waiting'] || 0,
        active: counts['active'] || 0,
        delayed: counts['delayed'] || 0,
        failed: counts['failed'] || 0
      }
    };
  } catch {
    return { status: 'unavailable', counts: emptyCounts };
  }
};
