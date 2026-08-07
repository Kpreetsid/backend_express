import { OutboxEventModel } from '../models/outboxEvent.model';
import { applicationLogger } from '../observability/logger';
import {
  outboxDeadLetterCounter,
  outboxPublishedCounter
} from '../observability/metrics';
import { queueConfig } from '../configDB';
import { enqueueEvent } from './queue-registry';

const retryDelayMs = (attempt: number): number =>
  Math.min(15 * 60 * 1000, 1000 * (2 ** Math.max(0, attempt - 1)));

export const publishPendingOutboxEvents = async (limit = 100): Promise<number> => {
  let published = 0;

  for (let index = 0; index < limit; index += 1) {
    const event = await OutboxEventModel.findOneAndUpdate(
      {
        status: { $in: ['pending', 'failed', 'processing'] },
        $or: [
          { nextAttemptAt: { $exists: false } },
          { nextAttemptAt: { $lte: new Date() } }
        ]
      },
      {
        $set: {
          status: 'processing',
          nextAttemptAt: new Date(Date.now() + 5 * 60 * 1000)
        },
        $inc: { attempts: 1 }
      },
      { new: true, sort: { createdAt: 1 } }
    );
    if (!event) break;

    try {
      await enqueueEvent('domain-events', {
        eventId: event.eventId,
        type: event.type,
        version: event.version,
        tenantId: event.tenantId,
        ...(event.actorId ? { actorId: event.actorId } : {}),
        correlationId: event.correlationId,
        entity: event.entity,
        timestamp: event.timestamp,
        payload: event.payload
      });
      await OutboxEventModel.updateOne(
        { _id: event._id, status: 'processing' },
        {
          $set: { status: 'published', publishedAt: new Date() },
          $unset: { nextAttemptAt: '', lastError: '' }
        }
      );
      outboxPublishedCounter.inc();
      published += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown outbox publish error';
      const exhausted = event.attempts >= queueConfig.outboxMaxAttempts;
      await OutboxEventModel.updateOne(
        { _id: event._id },
        exhausted
          ? {
              $set: {
                status: 'dead-letter',
                lastError: message.slice(0, 1000),
                deadLetteredAt: new Date()
              },
              $unset: { nextAttemptAt: '' }
            }
          : {
              $set: {
                status: 'failed',
                lastError: message.slice(0, 1000),
                nextAttemptAt: new Date(Date.now() + retryDelayMs(event.attempts))
              }
            }
      );
      if (exhausted) {
        outboxDeadLetterCounter.inc();
      }
      applicationLogger.error(
        {
          err: error,
          eventId: event.eventId,
          tenantId: event.tenantId,
          status: exhausted ? 'dead-letter' : 'failed',
          attempts: event.attempts
        },
        exhausted ? 'Outbox event moved to dead letter' : 'Outbox event publish failed'
      );
    }
  }

  return published;
};

export const redriveDeadLetterEvent = async (
  eventId: string,
  tenantId: string
): Promise<boolean> => {
  const result = await OutboxEventModel.updateOne(
    { eventId, tenantId, status: 'dead-letter' },
    {
      $set: {
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date()
      },
      $unset: {
        deadLetteredAt: '',
        publishedAt: '',
        lastError: ''
      }
    }
  );
  return result.modifiedCount === 1;
};
