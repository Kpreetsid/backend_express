import mongoose, { Schema, Document } from 'mongoose';

export interface IAccount extends Document {
  account_name: string;
  account_status: 'active' | 'inactive';
  type: string;
  fileName: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const accountSchema = new Schema<IAccount>(
  {
    account_name: { type: String, required: true },
    account_status: { type: String, required: true, enum: ['active', 'inactive'], default: 'active' },
    type: { type: String, required: true },
    fileName: { type: String, required: true }
  },
  {
    collection: 'account_master',
    timestamps: true
  }
);

export const Account = mongoose.model<IAccount>('Account', accountSchema);
