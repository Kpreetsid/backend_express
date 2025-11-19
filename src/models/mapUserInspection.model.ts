import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface IMapUserInspection extends Document {
  account_id?: ObjectId;
  user_id: ObjectId;
  inspection_id: ObjectId;
}

const MapUserInspectionSchema = new Schema<IMapUserInspection>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  inspection_id: { type: mongoose.Schema.Types.ObjectId, ref: 'InspectionModel', required: true }
}, {
  collection: 'map_user_inspection',
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

export const MapUserInspectionModel = mongoose.model<IMapUserInspection>('Schema_MapUserInspection', MapUserInspectionSchema);
