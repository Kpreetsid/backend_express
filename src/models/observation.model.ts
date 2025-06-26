import mongoose, { Schema, Document, ObjectId } from 'mongoose';

interface PhoneNumber {
  number: string;
  internationalNumber: string;
  nationalNumber: string;
  e164Number: string;
  countryCode: string;
  dialCode: string;
}

interface AccountInfo {
  account_name: string;
  account_status: string;
  id: string;
  type: string;
  fileName?: string;
}

interface UserInfo {
  firstName: string;
  lastName: string;
  username: string;
  pincode: string | null;
  email: string;
  emailStatus: boolean;
  user_status: string;
  user_role: string;
  createdOn: string;
  id: string;
  account_id: string;
  phone_no: PhoneNumber;
  isFirstUser: boolean;
  address: string;
  mobileNumber: string;
  accounts: AccountInfo;
}

export interface IObservation extends Document {
  observation: string;
  recommendation: string;
  faults: string[];
  files: Record<string, any>;
  createdOn: Date;
  assetId: ObjectId;
  accountId: ObjectId;
  status: string;
  user: UserInfo;
  alarmId: number;
  locationId: ObjectId;
  top_level_asset_id: ObjectId;
  id?: ObjectId;
}

const ObservationSchema = new Schema<IObservation>({
  observation: { type: String, required: true },
  recommendation: { type: String, required: true },
  faults: { type: [String] },
  files: { type: Schema.Types.Mixed, default: {} },
  createdOn: { type: Date, default: Date.now },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  status: { type: String, required: true },
  user: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    username: { type: String, required: true },
    pincode: { type: String },
    email: { type: String, required: true },
    emailStatus: { type: Boolean, default: false },
    user_status: { type: String, required: true },
    user_role: { type: String, required: true },
    createdOn: { type: String, required: true },
    id: { type: String, required: true },
    account_id: { type: String, required: true },
    phone_no: {
      number: { type: String, required: true },
      internationalNumber: { type: String, required: true },
      nationalNumber: { type: String, required: true },
      e164Number: { type: String, required: true },
      countryCode: { type: String, required: true },
      dialCode: { type: String, required: true }
    },
    isFirstUser: { type: Boolean, default: false },
    address: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    accounts: {
      account_name: { type: String, required: true },
      account_status: { type: String, required: true },
      id: { type: String, required: true },
      type: { type: String, required: true },
      fileName: { type: String, default: null }
    }
  },
  alarmId: { type: Number, required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationMaster', required: true },
  top_level_asset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
  id: { type: mongoose.Schema.Types.ObjectId, default: null }
}, {
  collection: 'observation',
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      ret.id = ret._id;
      return ret;
    }
  }
});

export const Observation = mongoose.model<IObservation>('Observation', ObservationSchema);
