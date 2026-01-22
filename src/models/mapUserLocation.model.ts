import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IMapUserLocation extends Document {
  account_id?: ObjectId;
  userId: ObjectId;
  locationId?: ObjectId;
  assetId?: ObjectId;
  sendMail?: boolean;
  alert?: boolean;
  danger?: boolean;
  critical?: boolean;

}

const MapUserLocationSchema = new Schema<IMapUserLocation>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel' },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetModel' },
  sendMail: { type: Boolean, default: true },
  alert: { type: Boolean, default: true },
  danger: { type: Boolean, default: true },
  critical: { type: Boolean, default: true }
}, {
  collection: 'location_user_mapping',
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

export const MapUserAssetLocationModel = mongoose.model<IMapUserLocation>('Schema_MapUserLocation', MapUserLocationSchema);
