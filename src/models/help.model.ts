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

export interface IBlog extends Document {
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
  isActive?: boolean;
}

const BlogSchema = new Schema<IBlog>({
  title: { type: String },
  description: { type: String, required: true },
  createdOn: { type: Date, default: Date.now },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  user: { type: Object },
  location: { type: [Object] },
  asset: { type: [Object] },
  problemType: { type: String, required: true },
  postPriority: { type: String, required: true },
  files: { type: [String] },
  status: { type: String },
  emailId: { type: String },
  tags: { type: Object },
  help: { type: Boolean, default: false },
  comments: { type: [Schema.Types.Mixed] },
  likes: { type: [Schema.Types.Mixed] },
  isActive: { type: Boolean, default: true }
}, {
  collection: 'help',
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

export const Blog = mongoose.model<IBlog>('Blog', BlogSchema);
