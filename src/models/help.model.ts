import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IBlog extends Document {
  title?: string;
  description: string;
  createdOn: Date;
  account_id: ObjectId;
  userId?: ObjectId;
  user?: Object;
  location?: object[];
  asset?: object[];
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
  visible?: boolean;
}

const BlogSchema = new Schema<IBlog>({
  title: { type: String, trim: true },
  description: { type: String, trim: true, required: true },
  createdOn: { type: Date, default: Date.now },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' },
  user: { type: Object },
  location: { type: [Object] },
  asset: { type: [Object] },
  problemType: { type: String, trim: true, required: true },
  postPriority: { type: String, trim: true, required: true },
  files: { type: [String] },
  status: { type: String, trim: true },
  emailId: { type: String, trim: true },
  tags: { type: Object },
  help: { type: Boolean, default: false },
  comments: { type: [Schema.Types.Mixed] },
  likes: { type: [Schema.Types.Mixed] },
  visible: { type: Boolean, default: true }
}, {
  collection: 'help',
  timestamps: true,
  versionKey: false,
  toJSON: { 
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id;
        return ret;
      }
    },
    toObject: { 
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id;
        return ret;
      }
    }
});

export const BlogModel = mongoose.model<IBlog>('Schema_Blog', BlogSchema);
