import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export const STATUS = ['active', 'inactive'];
export const ROLE = ['super_admin', 'super_employee', 'super_user', 'admin', 'manager', 'employee', 'customer', 'user'];
export const USER_ROLES = ["admin", "manager", "employee", "customer", "user"];
export const SUPER_ROLES = ["super_admin", "super_employee", "super_user"];

export interface UserLoginPayload {
  id: string;
  companyID: string;
  username: string;
}
export interface IUser extends Document {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  email: string;
  emailStatus: boolean;
  user_status: 'active' | 'inactive' | string;
  user_role: 'super_admin' | 'super_employee' | 'super_user' | 'admin' | 'manager' | 'employee' | 'customer' | 'user';
  createdOn: Date;
  user_profile_img: string;
  account_id: ObjectId;
  phone_no: object;
  isFirstUser: boolean;
  isVerified: boolean;
  createdBy?: ObjectId;
  updatedBy?: ObjectId;
}

export const userSchema = new Schema<IUser>({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, trim: true },
  username: { type: String, required: true, unique: true , trim: true },
  password: { type: String, required: true, select: false },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  emailStatus: { type: Boolean, default: false },
  user_profile_img: { type: String },
  user_status: { type: String, enum: STATUS, default: 'active' },
  user_role: { type: String, required: true, enum: ROLE, default: 'employee', trim: true, lowercase: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  phone_no: { type: Object, required: true },
  isFirstUser: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: 'users',
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  }
});

export const UserModel = mongoose.model<IUser>('Schema_User', userSchema);