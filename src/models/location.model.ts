import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface ILocationMaster extends Document {
  location_name: string;
  description: string;
  location_type: string;
  top_level: boolean;
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
  location_name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  location_type: { type: String, trim: true, required: true },
  top_level: { type: Boolean, required: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  top_level_location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel' },
  parent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel' },
  parent_name: { type: String, trim: true },
  equipment_id: { type: String, trim: true },
  teamId: { type: String, trim: true },
  image_path: { type: String, trim: true },
  top_level_location_image: { type: String, trim: true },
  location: { type: String, trim: true },
  qr_code: { type: String, trim: true },
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
      delete (ret as any)._id;
      return ret;
    }
  }
});

export const LocationModel = mongoose.model<ILocationMaster>('Schema_Location', locationMasterSchema);
