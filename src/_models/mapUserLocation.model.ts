import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface IMapUserLocation extends Document {
  _id: ObjectId;
  userId: ObjectId;
  locationId?: ObjectId;
  assetId?: ObjectId;
}

const MapUserLocationSchema = new Schema<IMapUserLocation>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationMaster', default: null },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetMaster', default: null }
}, {
  collection: 'location_user_mapping',
  timestamps: true,
  versionKey: false
});

export const MapUserLocation = mongoose.model<IMapUserLocation>('MapUserLocation', MapUserLocationSchema);
