import mongoose, { Schema, Document } from 'mongoose';
import { ACCOUNT_ROLE_MENU_SCHEMA_VERSION, RoleManager } from '../../users/constants/account-role-menu.constant';
import { EXPERIENCE_PROFILES, ExperienceProfile } from '../../../common/constants/experience-profile.constant';
export const COMPANY_COLLECTION_NAME = `account_master`;
export const STATUS_ENUM = ['active', 'inactive'];
export { EXPERIENCE_PROFILES } from '../../../common/constants/experience-profile.constant';
export const COOKIES_ENUM = ['enabled', 'disabled'];
export const SUBSCRIPTION_TYPES = ['free', 'trial', 'monthly', 'yearly', 'one_time', 'lifetime'] as const;
export const SUBSCRIPTION_STATUSES = ['active', 'inactive', 'expired', 'cancelled', 'suspended'] as const;

export interface CompanyAssignment {
  user_ids: string[];
  status: 'registering' | 'pending' | 'assigned';
  attempts: number;
  next_attempt_at: Date;
  last_error?: string;
}

export interface IAccount extends Document {
  account_name: string;
  type: string;
  experience_profile: ExperienceProfile;
  description: string;
  fileName?: string;
  default_language?: string;
  sensor_uptime_email_mapping?: mongoose.Types.ObjectId;
  cookie_status?: string;
  two_step_auth_enabled?: boolean;
  two_step_auth_revision?: number;
  two_step_auth_updated_by?: mongoose.Types.ObjectId;
  two_step_auth_updated_at?: Date;
  encrypt_payload?: string;
  encrypt_response?: string;
  account_role_menu?: object;
  account_role_menu_profile?: ExperienceProfile;
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
    // Optional until recipients are first saved; existing accounts need no backfill.
    sensor_uptime_email_mapping: { type: Schema.Types.ObjectId, ref: 'Schema_SensorUptimeEmailRecipients' },
    default_language: { type: String, trim: true, default: 'en' },
    cookie_status: { type: String, trim: true, enum: COOKIES_ENUM, default: COOKIES_ENUM[1] },
    two_step_auth_enabled: { type: Boolean, default: false },
    two_step_auth_revision: { type: Number, default: 0, min: 0 },
    two_step_auth_updated_by: { type: mongoose.Schema.Types.ObjectId },
    two_step_auth_updated_at: { type: Date },
    encrypt_payload: { type: String, trim: true, enum: COOKIES_ENUM, default: COOKIES_ENUM[1] },
    encrypt_response: { type: String, trim: true, enum: COOKIES_ENUM, default: COOKIES_ENUM[1] },
    account_role_menu: {
      type: Object,
      required: true,
      default: function (this: IAccount) {
        return RoleManager.getRoleMenu(this.experience_profile || EXPERIENCE_PROFILES[0]);
      }
    },
    account_role_menu_profile: {
      type: String,
      trim: true,
      enum: EXPERIENCE_PROFILES,
      default: function (this: IAccount) {
        return this.experience_profile || EXPERIENCE_PROFILES[0];
      }
    },
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

export interface SensorRecipientUserDetail {
  user_id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  user_role: string;
  user_status: string;
}

export interface ISensorUptimeEmailRecipients extends Document {
  account_id: mongoose.Types.ObjectId;
  usersDetail: SensorRecipientUserDetail[];
}

const sensorRecipientUserSchema = new Schema<SensorRecipientUserDetail>({
  user_id: { type: Schema.Types.ObjectId, ref: 'Schema_User', required: true },
  firstName: { type: String, trim: true, default: '' },
  lastName: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true, required: true },
  user_role: { type: String, trim: true, default: '' },
  user_status: { type: String, enum: ['active', 'inactive', ''], default: '' }
}, { _id: false });

// Reuse the account ID so concurrent first saves and retries share one mapping.
const sensorUptimeEmailRecipientsSchema = new Schema<ISensorUptimeEmailRecipients>({
  account_id: { type: Schema.Types.ObjectId, ref: 'Schema_Account', required: true, unique: true, immutable: true },
  usersDetail: {
    type: [sensorRecipientUserSchema], default: [],
    validate: { validator: (users: SensorRecipientUserDetail[]) => users.length <= 500, message: 'At most 500 users are allowed' }
  }
}, { collection: 'sensor_uptime_email_recipients', timestamps: true, versionKey: false });

export const SensorUptimeEmailRecipientsModel = mongoose.model<ISensorUptimeEmailRecipients>(
  'Schema_SensorUptimeEmailRecipients', sensorUptimeEmailRecipientsSchema
);
