import mongoose, { Schema, Document } from 'mongoose';

export interface IAccount extends Document {
  account_name: string;
  account_status: string;
  type: string;
  fileName: string;
}

const accountSchema = new Schema<IAccount>({
  account_name: {
    type: String,
    required: true
  },
  account_status: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  }
}, {
  collection: 'account_master', // Adjust if your collection name is different
  timestamps: true // Optional: adds createdAt and updatedAt
});

export const Account = mongoose.model<IAccount>('Account', accountSchema);
