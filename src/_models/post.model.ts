import mongoose, { Schema, Document } from 'mongoose';

interface IFile {
  container: string;
  name: string;
  type: string;
  field: string;
  originalFilename: string;
  size: number;
}

interface IPhoneNumber {
  number: string;
  internationalNumber: string;
  nationalNumber: string;
  e164Number: string;
  countryCode: string;
  dialCode: string;
}

interface IUserAccount {
  account_name: string;
  account_status: string;
  id: string;
  type: string;
  fileName: string;
}

interface IUser {
  firstName: string;
  lastName: string;
  username: string;
  pincode: string | null;
  email: string;
  emailStatus: boolean;
  user_status: string;
  user_role: string;
  createdOn: Date;
  id: string;
  account_id: string;
  phone_no: IPhoneNumber;
  isFirstUser: boolean;
  address: string | null;
  mobileNumber: IPhoneNumber;
  userrole: string;
  userstatus: string;
  accounts: IUserAccount;
}

export interface IPost extends Document {
  postType: string;
  relatedTo: string;
  description: string;
  files: { [key: string]: IFile[] };
  createdOn: Date;
  account_id: mongoose.Types.ObjectId;
  user: IUser;
  help: boolean;
  publishTo: string[];
  comments: string[];
  likes: string[];
}

const PhoneNumberSchema = new Schema<IPhoneNumber>({
  number: String,
  internationalNumber: String,
  nationalNumber: String,
  e164Number: String,
  countryCode: String,
  dialCode: String,
}, { _id: false });

const UserAccountSchema = new Schema<IUserAccount>({
  account_name: String,
  account_status: String,
  id: String,
  type: String,
  fileName: String,
}, { _id: false });

const UserSchema = new Schema<IUser>({
  firstName: String,
  lastName: String,
  username: String,
  pincode: { type: String, default: null },
  email: String,
  emailStatus: Boolean,
  user_status: String,
  user_role: String,
  createdOn: Date,
  id: String,
  account_id: String,
  phone_no: PhoneNumberSchema,
  isFirstUser: Boolean,
  address: { type: String, default: null },
  mobileNumber: PhoneNumberSchema,
  userrole: String,
  userstatus: String,
  accounts: UserAccountSchema,
}, { _id: false });

const FileSchema = new Schema<IFile>({
  container: String,
  name: String,
  type: String,
  field: String,
  originalFilename: String,
  size: Number,
}, { _id: false });

const PostSchema = new Schema<IPost>({
  postType: { type: String, required: true },
  relatedTo: { type: String, required: true },
  description: { type: String, required: true },
  files: { type: Map, of: [FileSchema] },
  createdOn: { type: Date, default: Date.now },
  account_id: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  user: { type: UserSchema, required: true },
  help: { type: Boolean, default: false },
  publishTo: { type: [String], default: [] },
  comments: { type: [String], default: [] },
  likes: { type: [String], default: [] },
}, { 
  collection: 'post',
  timestamps: true ,
  versionKey: false
});

export const Post = mongoose.model<IPost>('Post', PostSchema);
