import mongoose, { Schema, Document } from 'mongoose';

export interface IMapUserLocation extends Document {
  userId: mongoose.Types.ObjectId;
  locationId?: mongoose.Types.ObjectId;
  assetId?: mongoose.Types.ObjectId;
}

const MapUserLocationSchema = new Schema<IMapUserLocation>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationMaster', default: null },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetMaster', default: null }
}, {
  collection: 'location_user_mapping',
  timestamps: true
});

export const MapUserLocation = mongoose.model<IMapUserLocation>('MapUserLocation', MapUserLocationSchema);
