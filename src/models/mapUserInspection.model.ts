import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

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
  collection: 'map_user_inspection',
  versionKey: false
});

export const MapUserInspectionModel = mongoose.model<IMapUserInspection>('Schema_MapUserInspection', MapUserInspectionSchema);
