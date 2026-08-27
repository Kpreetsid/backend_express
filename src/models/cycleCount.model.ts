import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from 'mongodb';
export const CYCLE_COUNT_COLLECTION_NAME = 'cycle_counts';


export const CYCLE_COUNT_STATUSES = ['pending', 'pending-approval', 'approved', 'rejected'] as const;
export type CycleCountStatus = typeof CYCLE_COUNT_STATUSES[number];

export interface ICycleCount extends Document {
  account_id: ObjectId;
  part_id: ObjectId;
  part_name: string;
  part_number: string;
  barcode?: string;
  location_id: ObjectId;
  system_quantity: number;
  counted_quantity: number;
  discrepancy_quantity: number;
  discrepancy_percent: number;
  status: CycleCountStatus;
  reason?: string;
  approval_notes?: string;
  createdBy: ObjectId;
  createdByName?: string;
  reviewedBy?: ObjectId;
  reviewedByName?: string;
  reviewedAt?: Date;
  visible: boolean;
}

const cycleCountSchema = new Schema<ICycleCount>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true, index: true },
  part_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Schema_Part', required: true, index: true },
  part_name: { type: String, trim: true, required: true },
  part_number: { type: String, trim: true, required: true },
  barcode: { type: String, trim: true },
  location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel', required: true, index: true },
  system_quantity: { type: Number, required: true },
  counted_quantity: { type: Number, required: true },
  discrepancy_quantity: { type: Number, required: true },
  discrepancy_percent: { type: Number, required: true },
  status: { type: String, enum: CYCLE_COUNT_STATUSES, default: 'pending' },
  reason: { type: String, trim: true, maxlength: 500 },
  approval_notes: { type: String, trim: true, maxlength: 500 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  createdByName: { type: String, trim: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' },
  reviewedByName: { type: String, trim: true },
  reviewedAt: { type: Date },
  visible: { type: Boolean, default: true }
}, {
  collection: CYCLE_COUNT_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
});

cycleCountSchema.index({ account_id: 1, status: 1, createdAt: -1 });
cycleCountSchema.index({ account_id: 1, part_id: 1, createdAt: -1 });

export const CycleCountModel = mongoose.model<ICycleCount>('Schema_CycleCount', cycleCountSchema);
