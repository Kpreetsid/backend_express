import { randomUUID } from 'node:crypto';
import { ClientSession } from 'mongoose';
import { OutboxEventModel } from '../models/outboxEvent.model';
import { QueueEventEnvelope } from './event-envelope';

export interface CreateOutboxEventInput<TPayload = Record<string, unknown>> {
  eventId?: string;
  type: string;
  version?: number;
  tenantId: string;
  actorId?: string;
  correlationId: string;
  entity: QueueEventEnvelope['entity'];
  timestamp?: string;
  payload: TPayload;
}

export interface OutboxWriteOptions {
  session?: ClientSession;
}

const requireValue = (name: string, value: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
};

/**
 * Writes a versioned event to MongoDB. Call this with the same ClientSession as
 * the business mutation so the mutation and its downstream event commit or
 * roll back together.
 */
export const createOutboxEvent = async <TPayload extends Record<string, unknown>>(
  input: CreateOutboxEventInput<TPayload>,
  options: OutboxWriteOptions = {}
): Promise<QueueEventEnvelope<TPayload>> => {
  const version = input.version ?? 1;
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error('version must be a positive integer');
  }

  const envelope: QueueEventEnvelope<TPayload> = {
    eventId: requireValue('eventId', input.eventId ?? randomUUID()),
    type: requireValue('type', input.type),
    version,
    tenantId: requireValue('tenantId', input.tenantId),
    ...(input.actorId ? { actorId: requireValue('actorId', input.actorId) } : {}),
    correlationId: requireValue('correlationId', input.correlationId),
    entity: {
      type: requireValue('entity.type', input.entity.type),
      id: requireValue('entity.id', input.entity.id)
    },
    timestamp: input.timestamp ?? new Date().toISOString(),
    payload: input.payload
  };

  await OutboxEventModel.create(
    [{
      ...envelope,
      status: 'pending',
      attempts: 0
    }],
    options.session ? { session: options.session } : undefined
  );

  return envelope;
};
