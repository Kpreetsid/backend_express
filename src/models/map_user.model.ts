import mongoose, { Schema, Document, ObjectId } from 'mongoose';

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
  collection: 'map_users',
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

export const ExternalUserModel = mongoose.model<IUser>('Schema_External_User', userSchema);