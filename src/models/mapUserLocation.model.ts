import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface IMapUserLocation extends Document {
  _id: ObjectId;
  userId: ObjectId;
  locationId?: ObjectId;
  assetId?: ObjectId;
  sendMail?: boolean;
}

const MapUserLocationSchema = new Schema<IMapUserLocation>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationMaster' },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
  sendMail: { type: Boolean, default: true }
}, {
  collection: 'location_user_mapping',
  timestamps: true,
  versionKey: false
});

export const MapUserAssetLocation = mongoose.model<IMapUserLocation>('MapUserLocation', MapUserLocationSchema);
