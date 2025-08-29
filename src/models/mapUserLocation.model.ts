import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface IMapUserLocation extends Document {
  _id: ObjectId;
  account_id?: ObjectId;
  userId: ObjectId;
  locationId?: ObjectId;
  assetId?: ObjectId;
  sendMail?: boolean;
}

const MapUserLocationSchema = new Schema<IMapUserLocation>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationMaster' },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
  sendMail: { type: Boolean, default: true }
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
