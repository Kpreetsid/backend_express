import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const MAP_USER_COLLECTION_NAME = 'map_users';


export interface IUser extends Document {
  user_id: ObjectId;
  username: string;
  account_id: ObjectId;
  visible: boolean;
}

const userSchema = new Schema<IUser>({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  username: { type: String, trim: true, required: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  visible: { type: Boolean, default: true }
}, {
  collection: MAP_USER_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
});

export const ExternalUserModel = mongoose.model<IUser>('Schema_External_User', userSchema);