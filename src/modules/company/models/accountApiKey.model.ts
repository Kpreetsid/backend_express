import mongoose, { Schema, Document } from 'mongoose';

export const ACCOUNT_API_KEY_COLLECTION_NAME = 'account_api_key';

export interface IAccountApiKey extends Document {
  account_id: mongoose.Types.ObjectId;
  download_api_key: string;
  type: string;
  visible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const accountApiKeySchema = new Schema<IAccountApiKey>(
  {
    account_id: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true
    },
    download_api_key: {
      type: String,
      trim: true,
      required: true
    },
    type: {
      type: String,
      trim: true,
      default: 'download_api_key'
    },
    visible: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    collection: ACCOUNT_API_KEY_COLLECTION_NAME,
    timestamps: true,
    versionKey: false
  }
);

accountApiKeySchema.index({ account_id: 1, visible: 1 });
accountApiKeySchema.index({ download_api_key: 1 });

export const AccountApiKeyModel = mongoose.model<IAccountApiKey>('AccountApiKey', accountApiKeySchema);
