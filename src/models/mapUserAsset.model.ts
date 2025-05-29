import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface IMapUserAsset extends Document {
  _id: ObjectId;
  userId: ObjectId;
  assetId?: ObjectId;
  accountId: ObjectId;
}

const MapUserAssetSchema = new Schema<IMapUserAsset>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', default: null },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
}, {
  collection: 'map_user_asset',
  timestamps: true,
  versionKey: false
});

export const MapUserAsset = mongoose.model<IMapUserAsset>('MapUserAsset', MapUserAssetSchema);
