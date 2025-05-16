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
  title?: string;
  description: string;
  createdOn: Date;
  account_id: ObjectId;
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
}

const WorkRequestSchema = new Schema<IWorkRequest>({
  title: { type: String, default: null },
  description: { type: String, required: true },
  createdOn: { type: Date, default: Date.now },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  user: { type: Object, default: null },
  location: { type: [Object], default: [] },
  asset: { type: [Object], default: [] },
  problemType: { type: String, required: true },
  postPriority: { type: String, required: true },
  files: { type: [String], default: [] },
  status: { type: String, default: null },
  emailId: { type: String, default: null },
  tags: { type: Object, default: null },
  help: { type: Boolean, default: false },
  comments: { type: [Schema.Types.Mixed], default: [] },
  likes: { type: [Schema.Types.Mixed], default: [] }
}, {
  collection: 'help',
  timestamps: true,
  versionKey: false
});

export const WorkRequestModel = mongoose.model<IWorkRequest>('Blog', WorkRequestSchema);
