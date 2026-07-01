import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const USER_TOKEN_COLLECTION_NAME = 'CustomAccessToken';


export interface IUserToken extends Document<string | mongoose.Types.ObjectId> {
  _id: string | mongoose.Types.ObjectId;
  token_id: mongoose.Types.ObjectId;
  ttl: number;
  created: Date;
  userId: ObjectId;
  principalType: string;
  isExternal: boolean;
  isInternal: boolean;
  expiresAt: Date;
}

const userTokenSchema = new Schema<IUserToken>({
  _id: { type: String , trim: true, required: true },
  token_id: { type: Schema.Types.ObjectId },
  ttl: { type: Number, required: true },
  created: { type: Date, required: true, default: Date.now },
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'UserModel' },
  principalType: { type: String, required: true },
  isExternal: { type: Boolean, default: false },
  isInternal: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true }
}, {
  collection: USER_TOKEN_COLLECTION_NAME,
  versionKey: false
});

export const TokenModel = mongoose.model<IUserToken>('Schema_UserToken', userTokenSchema);
