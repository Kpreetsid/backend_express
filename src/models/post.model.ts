import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
import { IUser, userSchema } from './user.model';
import { IUpload, uploadSchema } from './upload.model';

export interface IPost extends Document {
  postType: string;
  relatedTo: string;
  description: string;
  files: { [key: string]: IUpload[] };
  createdOn: Date;
  account_id: ObjectId;
  user: IUser;
  help: boolean;
  publishTo: string[];
  comments: string[];
  likes: string[];
}

const PostSchema = new Schema<IPost>({
  postType: { type: String, trim: true, required: true },
  relatedTo: { type: String, trim: true, required: true },
  description: { type: String, trim: true, required: true },
  files: { type: Map, of: [uploadSchema] },
  createdOn: { type: Date, default: Date.now },
  account_id: { type: Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  user: { type: userSchema, required: true },
  help: { type: Boolean, default: false },
  publishTo: { type: [String] },
  comments: { type: [String] },
  likes: { type: [String] },
}, { 
  collection: 'posts',
  timestamps: true ,
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

export const PostModel = mongoose.model<IPost>('Schema_Post', PostSchema);
