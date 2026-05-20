import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IPart extends Document {
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
  location_id: ObjectId;
  last_counted_at?: Date;
  currency: string;
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId
}

const partSchema = new Schema<IPart>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  part_name: { type: String, required: true, trim: true },
  part_number: { type: String, required: true, trim: true },
  barcode: { type: String, trim: true },
  part_type: { type: mongoose.Schema.Types.ObjectId, ref: 'Schema_PartsTypes', required: false },
  unit: { type: String, trim: true, required: true },
  description: { type: String, trim: true },
  quantity: { type: Number, required: true },
  min_quantity: { type: Number, required: true },
  reorder_point: { type: Number, default: 0 },
  cost: { type: Number, required: true },
  preferred_vendor: { type: String, trim: true },
  lead_time_days: { type: Number, default: 0 },
  location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel', required: true },
  last_counted_at: { type: Date },
  currency: { type: String, trim: true, default: 'INR' },
  visible: { type: Boolean, required: true, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: 'parts',
  timestamps: true,
  versionKey: false
});

export const PartsModel = mongoose.model<IPart>('Schema_Part', partSchema);
