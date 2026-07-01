import mongoose, { Schema, Document } from 'mongoose';
export const COMPANY_COLLECTION_NAME = `account_master`;
export const STATUS_ENUM = ['active', 'inactive'];
export const EXPERIENCE_PROFILES = ['standard_account', 'oem'] as const;
export const COOKIES_ENUM = ['enabled', 'disabled'];

export interface IAccount extends Document {
  account_name: string;
  type: string;
  experience_profile: typeof EXPERIENCE_PROFILES[number];
  description: string;
  fileName?: string;
  default_language?: string;
  cookies?: string;
  account_status: string;
  visible: boolean;
}

const accountSchema = new Schema<IAccount>(
  {
    account_name: { type: String, required: true, unique: true, trim: true },
    type: { type: String, trim: true, required: true },
    experience_profile: { type: String, trim: true, enum: EXPERIENCE_PROFILES, default: EXPERIENCE_PROFILES[0] },
    description: { type: String, trim: true },
    fileName: { type: String, trim: true },
    default_language: { type: String, trim: true, default: 'en' },
    cookies: { type: String, trim: true, enum: COOKIES_ENUM, default: COOKIES_ENUM[0] },
    account_status: { type: String, trim: true, enum: STATUS_ENUM, default: STATUS_ENUM[0] },
    visible: { type: Boolean, required: true, default: true }
  },
  {
    collection: COMPANY_COLLECTION_NAME,
    timestamps: true,
    versionKey: false
  }
);

export const AccountModel = mongoose.model<IAccount>('Schema_Account', accountSchema);
