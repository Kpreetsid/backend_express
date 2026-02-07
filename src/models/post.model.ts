import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IPost extends Document {
  account_id: ObjectId;
  title: string;
  postType: string;
  relatedTo: string;
  description: string;
  files: object;
  publishTo: string[];
  comments: string[];
  likes: string[];
  dislikes: string[];
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const PostSchema = new Schema<IPost>({
  account_id: { type: Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  title: { type: String, trim: true, required: true },
  postType: { type: String, trim: true, required: true },
  relatedTo: { type: String, trim: true, required: true },
  description: { type: String, trim: true, required: true },
  files: { type: Object },
  publishTo: { type: [String], default: [] },
  comments: { type: [String], default: [] },
  likes: { type: [String], default: [] },
  dislikes: { type: [String], default: [] },
  visible: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'UserModel' },
}, {
  collection: 'posts',
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

export const PostModel = mongoose.model<IPost>('Schema_Post', PostSchema);
