import mongoose, { Schema, Document } from 'mongoose';
import { ACCOUNT_ROLE_MENU_SCHEMA_VERSION, RoleManager } from '../_role/accountRoleMenu';
export const COMPANY_COLLECTION_NAME = `account_master`;
export const STATUS_ENUM = ['active', 'inactive'];
export const EXPERIENCE_PROFILES = ['standard_account', 'oem'] as const;
export const COOKIES_ENUM = ['enabled', 'disabled'];
export const SUBSCRIPTION_TYPES = ['free', 'trial', 'monthly', 'yearly', 'one_time', 'lifetime'] as const;
export const SUBSCRIPTION_STATUSES = ['active', 'inactive', 'expired', 'cancelled', 'suspended'] as const;

export interface IAccount extends Document {
  account_name: string;
  type: string;
  experience_profile: typeof EXPERIENCE_PROFILES[number];
  description: string;
  fileName?: string;
  default_language?: string;
  cookie_status?: string;
  redis_status?: string;
  encrypt_payload?: string;
  encrypt_response?: string;
  account_role_menu?: object;
  account_permission_version?: number;
  account_role_menu_schema_version?: number;
  account_role_menu_updated_by?: Schema.Types.ObjectId;
  account_role_menu_updated_at?: Date;
  subscription_plan?: string;
  subscription_type?: typeof SUBSCRIPTION_TYPES[number];
  subscription_start_date?: Date;
  subscription_end_date?: Date;
  subscription_status?: typeof SUBSCRIPTION_STATUSES[number];
  user_limit?: number;
  location_limit?: number;
  asset_limit?: number;
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
    cookie_status: { type: String, trim: true, enum: COOKIES_ENUM, default: COOKIES_ENUM[0] },
    redis_status: { type: String, trim: true, enum: COOKIES_ENUM, default: COOKIES_ENUM[0] },
    encrypt_payload: { type: String, trim: true, enum: COOKIES_ENUM, default: COOKIES_ENUM[0] },
    encrypt_response: { type: String, trim: true, enum: COOKIES_ENUM, default: COOKIES_ENUM[0] },
    account_role_menu: { type: Object, required: true, default: () => RoleManager.getRoleMenu(EXPERIENCE_PROFILES[0]) },
    account_permission_version: { type: Number, default: 1 },
    account_role_menu_schema_version: { type: Number, default: ACCOUNT_ROLE_MENU_SCHEMA_VERSION },
    account_role_menu_updated_by: { type: mongoose.Schema.Types.ObjectId },
    account_role_menu_updated_at: { type: Date },
    subscription_plan: { type: String, trim: true },
    subscription_type: { type: String, trim: true, enum: SUBSCRIPTION_TYPES, default: SUBSCRIPTION_TYPES[0] },
    subscription_start_date: { type: Date },
    subscription_end_date: { type: Date },
    subscription_status: { type: String, trim: true, enum: SUBSCRIPTION_STATUSES, default: SUBSCRIPTION_STATUSES[0] },
    user_limit: { type: Number, min: 0, default: 0 },
    location_limit: { type: Number, min: 0, default: 0 },
    asset_limit: { type: Number, min: 0, default: 0 },
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
