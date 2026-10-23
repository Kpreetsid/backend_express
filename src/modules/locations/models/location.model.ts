import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const LOCATION_COLLECTION_NAME = 'location_master';


export interface ILocationMaster extends Document {
  location_name: string;
  description: string;
  location_type: string;
  top_level: boolean;
  account_id: ObjectId;
  top_level_location_id: ObjectId;
  parent_id?: ObjectId;
  parent_name?: string;
  top_level_location_image?: string;
  image_path?: string;
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const locationMasterSchema = new Schema<ILocationMaster>({
  location_name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  location_type: { type: String, trim: true, required: true },
  top_level: { type: Boolean, required: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  top_level_location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel' },
  parent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel' },
  parent_name: { type: String, trim: true },
  image_path: { type: String, trim: true },
  top_level_location_image: { type: String, trim: true },
  visible: { type: Boolean, required: true, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: LOCATION_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
});

locationMasterSchema.index({ account_id: 1, visible: 1 });
locationMasterSchema.index({ parent_id: 1 });
locationMasterSchema.index({ top_level_location_id: 1 });

export const LocationModel = mongoose.model<ILocationMaster>('Schema_Location', locationMasterSchema);
