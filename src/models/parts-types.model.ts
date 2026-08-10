import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const PARTS_TYPES_COLLECTION_NAME = 'mst_part_types';


export interface IPartType extends Document {
  name: string;
  description: string;
  visible: boolean;
  account_id: ObjectId;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const partsTypeSchema = new Schema<IPartType>({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  visible: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: PARTS_TYPES_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
});

export const PartsTypeModel = mongoose.model<IPartType>('Schema_PartsTypes', partsTypeSchema);
