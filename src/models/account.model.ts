import mongoose, { Schema, Document } from 'mongoose';

export const STATUS = ['active', 'inactive'];
export const EXPERIENCE_PROFILES = ['standard_account', 'oem'] as const;

export interface IAccount extends Document {
  account_name: string;
  type: string;
  experience_profile: typeof EXPERIENCE_PROFILES[number];
  description: string;
  fileName?: string;
  account_status: string;
  visible: boolean;
}

const accountSchema = new Schema<IAccount>(
  {
    account_name: { type: String, required: true, unique: true, trim: true },
    type: { type: String, trim: true, required: true },
    experience_profile: { type: String, trim: true, enum: EXPERIENCE_PROFILES, default: 'standard_account' },
    description: { type: String, trim: true },
    fileName: { type: String, trim: true },
    account_status: { type: String, trim: true, enum: STATUS, default: 'active' },
    visible: { type: Boolean, required: true, default: true }
  },
  {
    collection: 'account_master',
    timestamps: true,
    versionKey: false
  }
);

export const AccountModel = mongoose.model<IAccount>('Schema_Account', accountSchema);
