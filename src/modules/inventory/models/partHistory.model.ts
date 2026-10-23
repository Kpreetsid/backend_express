import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const PART_HISTORY_COLLECTION_NAME = 'part_history';


export const PART_HISTORY_ACTIONS = [
  'created',
  'updated',
  'stock-added',
  'stock-removed',
  'stock-set',
  'transfer-out',
  'transfer-in',
  'cycle-count-submitted',
  'cycle-count-approved',
  'cycle-count-rejected'
] as const;

export type PartHistoryAction = typeof PART_HISTORY_ACTIONS[number];

export interface IPartHistory extends Document {
  account_id: ObjectId;
  part_id: ObjectId;
  part_name?: string;
  part_number?: string;
  location_id?: ObjectId;
  location_name?: string;
  action_type: PartHistoryAction;
  quantity?: number;
  stock_before?: number;
  stock_after?: number;
  note?: string;
  metadata?: Record<string, any>;
  actor_id?: ObjectId;
  actor_name?: string;
  visible: boolean;
}

const partHistorySchema = new Schema<IPartHistory>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true, index: true },
  part_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Schema_Part', required: true, index: true },
  part_name: { type: String, trim: true },
  part_number: { type: String, trim: true },
  location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel', index: true },
  location_name: { type: String, trim: true },
  action_type: { type: String, enum: PART_HISTORY_ACTIONS, required: true, index: true },
  quantity: { type: Number },
  stock_before: { type: Number },
  stock_after: { type: Number },
  note: { type: String, trim: true },
  metadata: { type: Schema.Types.Mixed },
  actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Schema_User' },
  actor_name: { type: String, trim: true },
  visible: { type: Boolean, default: true }
}, {
  collection: PART_HISTORY_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
});

partHistorySchema.index({ account_id: 1, part_id: 1, createdAt: -1 });

export const PartHistoryModel = mongoose.model<IPartHistory>('Schema_PartHistory', partHistorySchema);
