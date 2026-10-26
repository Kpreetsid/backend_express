import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const PART_COLLECTION_NAME = 'parts';

import { syncVersionPlugin } from '../../../core/database/plugins/sync-version.plugin';

export interface IPart extends Document {
  sync_version: number;
  account_id: ObjectId;
  part_name: string;
  part_number: string;
  barcode?: string;
  part_type?: ObjectId;
  unit: string;
  description: string;
  quantity: number;
  min_quantity: number;
  reorder_point?: number;
  cost: number;
  preferred_vendor?: string;
  lead_time_days?: number;
  location_id?: ObjectId;
  last_counted_at?: Date;
  currency: string;
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const partSchema = new Schema<IPart>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  part_name: { type: String, required: true, trim: true, maxlength: 160 },
  part_number: { type: String, required: true, trim: true, maxlength: 100 },
  barcode: { type: String, trim: true, maxlength: 120 },
  part_type: { type: mongoose.Schema.Types.ObjectId, ref: 'Schema_PartsTypes', required: false },
  unit: { type: String, trim: true, required: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 5000 },
  quantity: { type: Number, required: true, min: 0 },
  min_quantity: { type: Number, required: true, min: 0 },
  reorder_point: { type: Number, default: 0, min: 0 },
  cost: { type: Number, required: true, min: 0 },
  preferred_vendor: { type: String, trim: true, maxlength: 160 },
  lead_time_days: { type: Number, default: 0, min: 0 },
  location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel', required: false },
  last_counted_at: { type: Date },
  currency: { type: String, trim: true, uppercase: true, minlength: 3, maxlength: 3, default: 'INR' },
  visible: { type: Boolean, required: true, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: PART_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
});

partSchema.plugin(syncVersionPlugin);
partSchema.index({ account_id: 1, visible: 1 });
partSchema.index({ account_id: 1, part_number: 1 });
partSchema.index({ account_id: 1, location_id: 1 });
partSchema.index({ account_id: 1, part_number: 1, location_id: 1, visible: 1 });

export const PartsModel = mongoose.model<IPart>('Schema_Part', partSchema);
