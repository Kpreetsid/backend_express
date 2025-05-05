import mongoose, { Schema, Document } from 'mongoose';

export interface IUserToken extends Document {
  _id: string;
  ttl: number;
  created: Date;
  userId: mongoose.Types.ObjectId;
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
    ref: 'User'
  },
  principalType: {
    type: String,
    required: true
  }
}, {
  collection: 'CustomAccessToken'
});

export const UserToken = mongoose.model<IUserToken>('UserToken', userTokenSchema);
