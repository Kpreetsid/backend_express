import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const MAP_USER_LOCATION_COLLECTION_NAME = 'location_user_mapping';

export interface INotificationLevel {
  alert: boolean;
  danger: boolean;
  critical: boolean;
};

const notificationLevelSchema = new Schema<INotificationLevel>({
  alert: { type: Boolean, default: false },
  danger: { type: Boolean, default: false },
  critical: { type: Boolean, default: false }
}, { _id: false });

export interface IMapUserLocation extends Document {
  account_id?: ObjectId;
  userId: ObjectId;
  locationId?: ObjectId;
  assetId?: ObjectId;
  sendMail?: boolean;
  alert?: boolean;
  danger?: boolean;
  critical?: boolean;
  notifications: {
    email: INotificationLevel;
    push: INotificationLevel;
    sms: INotificationLevel;
    whatsapp: INotificationLevel;
  }
}

const MapUserLocationSchema = new Schema<IMapUserLocation>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel' },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetModel' },
  sendMail: { type: Boolean, default: true },
  alert: { type: Boolean, default: true },
  danger: { type: Boolean, default: true },
  critical: { type: Boolean, default: true },
  notifications: {
    email: { type: notificationLevelSchema, default: () => ({}) },
    push: { type: notificationLevelSchema, default: () => ({}) },
    sms: { type: notificationLevelSchema, default: () => ({}) },
    whatsapp: { type: notificationLevelSchema, default: () => ({}) }
  }
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
