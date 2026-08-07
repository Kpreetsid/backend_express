import mongoose, { Document, Schema } from 'mongoose';
import { QueueEventEnvelope } from '../queue/event-envelope';

export interface IOutboxEvent extends Document, QueueEventEnvelope {
  status: 'pending' | 'processing' | 'published' | 'failed' | 'dead-letter';
  attempts: number;
  nextAttemptAt?: Date;
  publishedAt?: Date;
  deadLetteredAt?: Date;
  lastError?: string;
}

const outboxEventSchema = new Schema<IOutboxEvent>({
  eventId: { type: String, required: true, unique: true, immutable: true },
  type: { type: String, required: true, immutable: true, index: true },
  version: { type: Number, required: true, immutable: true },
  tenantId: { type: String, required: true, immutable: true, index: true },
  actorId: { type: String, immutable: true },
  correlationId: { type: String, required: true, immutable: true },
  entity: {
    type: { type: String, required: true },
    id: { type: String, required: true }
  },
  timestamp: { type: String, required: true, immutable: true },
  payload: { type: Schema.Types.Mixed, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'published', 'failed', 'dead-letter'],
    default: 'pending',
    index: true
  },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, index: true },
  publishedAt: Date,
  deadLetteredAt: Date,
  lastError: String
}, {
  collection: 'outbox_events',
  timestamps: true,
  versionKey: false
});

outboxEventSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
outboxEventSchema.index({ tenantId: 1, type: 1, createdAt: -1 });

export const OutboxEventModel = mongoose.model<IOutboxEvent>('Schema_OutboxEvent', outboxEventSchema);
