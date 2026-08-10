import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const MAP_USER_LOCATION_COLLECTION_NAME = 'location_user_mapping';


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
  collection: MAP_USER_LOCATION_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
});

MapUserLocationSchema.index({ userId: 1 });
MapUserLocationSchema.index({ assetId: 1 });
MapUserLocationSchema.index({ locationId: 1 });
MapUserLocationSchema.index({ account_id: 1 });
MapUserLocationSchema.index({ userId: 1, assetId: 1 });

export const MapUserAssetLocationModel = mongoose.model<IMapUserLocation>('Schema_MapUserLocation', MapUserLocationSchema);
