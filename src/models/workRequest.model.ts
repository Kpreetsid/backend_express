import mongoose, { Schema, Document, ObjectId } from 'mongoose';

interface IPhoneNo {
  number: string;
  internationalNumber: string;
  nationalNumber: string;
  e164Number: string;
  countryCode: string;
  dialCode: string;
}

interface IUser {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  emailStatus: boolean;
  user_status: string;
  user_role: string;
  createdOn: Date | string;
  id: string;
  account_id: string;
  phone_no: IPhoneNo;
  isFirstUser: boolean;
}

interface ILocationItem {
  location_name: string;
  id: string;
  assigned_to: string;
}

interface IAssetItem {
  name: string;
  id: string;
  locId: string;
}

export interface IWorkRequest extends Document {
  account_id: ObjectId;
  title?: string;
  description: string;
  userId?: ObjectId;
  user?: IUser;
  location?: ILocationItem[];
  asset?: IAssetItem[];
  problemType: string;
  postPriority: string;
  files: string[];
  status?: string;
  emailId?: string;
  tags?: {
    id: string;
  };
  help?: boolean;
  comments?: any[];
  likes?: any[];
  isActive: boolean;
  createdBy: ObjectId;
  createdOn: Date;
  updatedBy?: ObjectId;
  updatedOn?: Date;
}

const WorkRequestSchema = new Schema<IWorkRequest>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  title: { type: String },
  description: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  user: { type: Object },
  location: { type: [Object] },
  asset: { type: [Object] },
  problemType: { type: String, required: true },
  postPriority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' },
  files: { type: [String] },
  status: { type: String },
  emailId: { type: String },
  tags: { type: Object },
  help: { type: Boolean, default: false },
  comments: { type: [Schema.Types.Mixed] },
  likes: { type: [Schema.Types.Mixed] },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdOn: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  collection: 'help',
  timestamps: true,
  versionKey: false
});

export const WorkRequestModel = mongoose.model<IWorkRequest>('Blog', WorkRequestSchema);
