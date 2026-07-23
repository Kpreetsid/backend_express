import mongoose, { Document, Schema } from 'mongoose';

export interface IIdempotencyRecord extends Document {
  key: string;
  account_id: string;
  user_id: string;
  method: string;
  path: string;
  request_hash: string;
  state: 'processing' | 'completed';
  response_status?: number;
  response_body?: unknown;
  response_headers?: Record<string, string>;
  expiresAt: Date;
}

const IdempotencyRecordSchema = new Schema<IIdempotencyRecord>({
  key: { type: String, required: true },
  account_id: { type: String, required: true },
  user_id: { type: String, required: true },
  method: { type: String, required: true },
  path: { type: String, required: true },
  request_hash: { type: String, required: true },
  state: { type: String, enum: ['processing', 'completed'], required: true, default: 'processing' },
  response_status: { type: Number },
  response_body: { type: Schema.Types.Mixed },
  response_headers: { type: Schema.Types.Mixed },
  expiresAt: { type: Date, required: true }
}, {
  collection: 'idempotency_records',
  timestamps: true,
  versionKey: false
});

IdempotencyRecordSchema.index({ account_id: 1, user_id: 1, key: 1 }, { unique: true });
IdempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IdempotencyRecordModel = mongoose.model<IIdempotencyRecord>('IdempotencyRecord', IdempotencyRecordSchema);
