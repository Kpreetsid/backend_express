import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const MAP_USER_INSPECTION_COLLECTION_NAME = 'map_user_inspection';


export interface IMapUserInspection extends Document {
  account_id?: ObjectId;
  user_id: ObjectId;
  inspection_id: ObjectId;
  createdAt: Date;
}

const MapUserInspectionSchema = new Schema<IMapUserInspection>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  inspection_id: { type: mongoose.Schema.Types.ObjectId, ref: 'InspectionModel', required: true },
  createdAt: { type: Date, default: Date.now }
}, {
  collection: MAP_USER_INSPECTION_COLLECTION_NAME,
  versionKey: false
});

MapUserInspectionSchema.index({ account_id: 1, user_id: 1, inspection_id: 1 }, { unique: true });
MapUserInspectionSchema.index({ account_id: 1, inspection_id: 1 });

export const MapUserInspectionModel = mongoose.model<IMapUserInspection>('Schema_MapUserInspection', MapUserInspectionSchema);
