import mongoose, { Schema, Document } from 'mongoose';

export interface UserLoginPayload {
  id: string;
  companyID: string;
  email: string;
  username: string;
}

export interface IPhoneNumber {
  number: string;
  internationalNumber: string;
  nationalNumber: string;
  e164Number: string;
  countryCode: string;
  dialCode: string;
}

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  email: string;
  emailStatus: boolean;
  user_status: 'active' | 'inactive' | string;
  user_role: 'admin' | 'user' | string;
  createdOn: Date;
  account_id: mongoose.Types.ObjectId;
  phone_no: IPhoneNumber;
  isFirstUser: boolean;
}

const phoneNumberSchema = new Schema<IPhoneNumber>({
  number: { type: String, required: true },
  internationalNumber: { type: String, required: true },
  nationalNumber: { type: String, required: true },
  e164Number: { type: String, required: true },
  countryCode: { type: String, required: true },
  dialCode: { type: String, required: true }
}, { _id: false });

const userSchema = new Schema<IUser>({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  emailStatus: { type: Boolean, default: false },
  user_status: { type: String, required: true, default: 'active' },
  user_role: { type: String, required: true },
  createdOn: { type: Date, default: Date.now },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  phone_no: { type: phoneNumberSchema, required: true },
  isFirstUser: { type: Boolean, default: false }
}, {
  collection: 'users',
  timestamps: true
});

export const User = mongoose.model<IUser>('User', userSchema);
