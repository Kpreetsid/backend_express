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
  top_level_location_image?: string;
  image_path?: string;
  location?: string;
  qr_code?: string;
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const locationMasterSchema = new Schema<ILocationMaster>({
  location_name: { type: String, required: true },
  description: { type: String },
  location_type: { type: String, required: true },
  top_level: { type: Boolean, required: true },
  assigned_to: { type: String, required: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  top_level_location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel' },
  parent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel' },
  parent_name: { type: String },
  equipment_id: { type: String },
  teamId: { type: String },
  image_path: { type: String },
  top_level_location_image: { type: String },
  location: { type: String },
  qr_code: { type: String },
  visible: { type: Boolean, required: true, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: 'location_master',
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  }
});

export const LocationModel = mongoose.model<ILocationMaster>('Schema_Location', locationMasterSchema);
