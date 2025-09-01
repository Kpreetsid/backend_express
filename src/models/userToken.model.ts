import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface IUserToken extends Document {
  _id: string;
  ttl: number;
  created: Date;
  userId: ObjectId;
  principalType: string;
}

const userTokenSchema = new Schema<IUserToken>({
  _id: { type: String, required: true },
  ttl: { type: Number, required: true },
  created: {
    type: Date,
    required: true,
    default: Date.now
  },
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'UserModel'
  },
  principalType: {
    type: String,
    required: true
  }
}, {
  collection: 'CustomAccessToken',
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

export const TokenModel = mongoose.model<IUserToken>('Schema_UserToken', userTokenSchema);
