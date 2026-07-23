import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const USER_TOKEN_COLLECTION_NAME = 'CustomAccessToken';


export interface IUserToken extends Document<string | mongoose.Types.ObjectId> {
  _id: string | mongoose.Types.ObjectId;
  tokenType: 'access' | 'refresh';
  token_id?: mongoose.Types.ObjectId;
  ttl?: number;
  created: Date;
  userId: ObjectId;
  accountId?: ObjectId;
  account_id?: ObjectId;
  principalType?: string;
  isExternal?: boolean;
  isInternal?: boolean;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByTokenHash?: string;
  userAgent?: string;
  ipAddress?: string;
}

const userTokenSchema = new Schema<IUserToken>({
  _id: { type: String , trim: true, required: true },
  tokenType: {
    type: String,
    enum: ['access', 'refresh'],
    required: true,
    default: 'access'
  },
  token_id: { type: Schema.Types.ObjectId },
  ttl: {
    type: Number,
    required: function(this: IUserToken): boolean {
      return this.tokenType === 'access';
    }
  },
  created: { type: Date, required: true, default: Date.now },
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'UserModel' },
  accountId: {
    type: Schema.Types.ObjectId,
    ref: 'AccountModel',
    required: function(this: IUserToken): boolean {
      return this.tokenType === 'refresh';
    }
  },
  account_id: { type: Schema.Types.ObjectId, ref: 'AccountModel', index: true },
  principalType: {
    type: String,
    required: function(this: IUserToken): boolean {
      return this.tokenType === 'access';
    }
  },
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

userTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
userTokenSchema.index({ tokenType: 1, userId: 1, accountId: 1, revokedAt: 1 });

userTokenSchema.index({ principalType: 1, userId: 1, account_id: 1, revokedAt: 1 });

export const TokenModel = mongoose.model<IUserToken>('Schema_UserToken', userTokenSchema);

export const getAccessTokenTypeFilter = (): Record<string, unknown> => ({
  $or: [
    { tokenType: 'access' },
    // Existing access-token documents predate the discriminator.
    { tokenType: { $exists: false } }
  ]
});
