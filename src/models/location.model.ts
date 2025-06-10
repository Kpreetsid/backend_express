import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface ILocationMaster extends Document {
  location_name: string;
  description: string;
  location_type: string;
  top_level: boolean;
  assigned_to: string;
  account_id: ObjectId;
  top_level_location_id: ObjectId;
  parent_id?: ObjectId;
  parent_name?: string;
  equipment_id?: string;
  teamId?: string | null;
  id?: ObjectId;
  image_path?: string;
  location?: string;
  qr_code?: string;
  visible: boolean;
}

const locationMasterSchema = new Schema<ILocationMaster>({
  location_name: { type: String, required: true },
  description: { type: String, default: '' },
  location_type: { type: String, required: true },
  top_level: { type: Boolean, required: true },
  assigned_to: { type: String, required: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  top_level_location_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  parent_id: { type: mongoose.Schema.Types.ObjectId },
  parent_name: { type: String },
  equipment_id: { type: String },
  teamId: { type: String },
  id: { type: mongoose.Schema.Types.ObjectId },
  image_path: { type: String },
  location: { type: String, default: '' },
  qr_code: { type: String, default: '' },
  visible: { type: Boolean, required: true },
}, {
  collection: 'location_master',
  timestamps: true,
  versionKey: false
});

export const LocationMaster = mongoose.model<ILocationMaster>('LocationMaster', locationMasterSchema);
