import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const USER_TOKEN_COLLECTION_NAME = 'CustomAccessToken';


export interface IUserToken extends Document<string | mongoose.Types.ObjectId> {
  _id: string | mongoose.Types.ObjectId;
  token_id: mongoose.Types.ObjectId;
  ttl: number;
  created: Date;
  userId: ObjectId;
  account_id?: ObjectId;
  principalType: string;
  isExternal: boolean;
  isInternal: boolean;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByTokenHash?: string;
  userAgent?: string;
  ipAddress?: string;
}

const userTokenSchema = new Schema<IUserToken>({
  _id: { type: String , trim: true, required: true },
  token_id: { type: Schema.Types.ObjectId },
  ttl: { type: Number, required: true },
  created: { type: Date, required: true, default: Date.now },
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'UserModel' },
  account_id: { type: Schema.Types.ObjectId, ref: 'AccountModel', index: true },
  principalType: { type: String, required: true },
  isExternal: { type: Boolean, default: false },
  isInternal: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
  replacedByTokenHash: { type: String },
  userAgent: { type: String },
  ipAddress: { type: String }
}, {
  collection: USER_TOKEN_COLLECTION_NAME,
  versionKey: false
});

userTokenSchema.index({ principalType: 1, userId: 1, account_id: 1, revokedAt: 1 });

export const TokenModel = mongoose.model<IUserToken>('Schema_UserToken', userTokenSchema);
