import mongoose, { Schema, Document, ObjectId } from 'mongoose';

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
  user_role: 'super_admin' | 'admin' | 'user' | 'employee' | string;
  createdOn: Date;
  device: string;
  user_profile_img: string;
  account_id: ObjectId;
  phone_no: IPhoneNumber;
  isFirstUser: boolean;
  isVerified: boolean;
  isActive: boolean;
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
  password: { type: String, required: true, select: false },
  email: { type: String, required: true, unique: true },
  emailStatus: { type: Boolean, default: false },
  user_profile_img: { type: String },
  user_status: { type: String, required: true, enum: ['active', 'inactive'], default: 'active' },
  user_role: { type: String, required: true, enum: ['super_admin', 'admin', 'user', 'employee'], default: 'user' },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  phone_no: { type: phoneNumberSchema, required: true },
  device: { type: String },
  isFirstUser: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, {
  collection: 'users',
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  }
});

export const User = mongoose.model<IUser>('User', userSchema);