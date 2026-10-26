import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const POST_COLLECTION_NAME = 'posts';


export interface IPost extends Document {
  account_id: ObjectId;
  title: string;
  subtitle?: string;
  postType: string;
  relatedTo: string;
  tags: string[];
  description: string;
  files: object[];
  publishTo: string[];
  comments: string[];
  likes: string[];
  dislikes: string[];
  status: string;
  visibility: string;
  featured: boolean;
  pinned: boolean;
  slug?: string;
  seoTitle?: string;
  seoDescription?: string;
  keywords: string[];
  scheduledAt?: Date | null;
  publishedAt?: Date | null;
  commentsEnabled: boolean;
  reviewHistory: object[];
  help: boolean;
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const PostFileSchema = new Schema({
  originalName: { type: String, trim: true, maxlength: 255 },
  type: { type: String, enum: ['image/jpeg', 'image/png', 'application/pdf'], required: true },
  folderName: { type: String, enum: ['posts'], required: true },
  fileName: { type: String, trim: true, maxlength: 255, required: true },
  size: { type: Number, min: 1, max: 5 * 1024 * 1024 }
}, { _id: false });

const ReviewHistorySchema = new Schema({
  status: { type: String, enum: ['Draft', 'Pending Review', 'Approved', 'Published', 'Scheduled', 'Archived', 'Rejected', 'Expired'], required: true },
  note: { type: String, trim: true, maxlength: 1000 },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true },
  reviewedAt: { type: Date, required: true }
}, { _id: false });

const PostSchema = new Schema<IPost>({
  account_id: { type: Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  title: { type: String, trim: true, required: true, maxlength: 160 },
  subtitle: { type: String, trim: true, maxlength: 240, default: '' },
  postType: { type: String, enum: ['General', 'Maintenance', 'Quality', 'Breakdown', 'Kaizen/improvement'], required: true },
  relatedTo: { type: String, enum: ['Assets', 'Locations', 'Products', 'Material', 'Method', 'Scan', 'Other'], required: true },
  tags: { type: [String], default: [], validate: [(value: string[]) => value.length <= 10, 'A maximum of 10 tags is allowed'] },
  description: { type: String, trim: true, required: true, maxlength: 50000 },
  files: { type: [PostFileSchema], default: [] },
  publishTo: { type: [String], default: [] },
  comments: { type: [String], default: [] },
  likes: { type: [String], default: [] },
  dislikes: { type: [String], default: [] },
  status: { type: String, enum: ['Draft', 'Pending Review', 'Approved', 'Published', 'Scheduled', 'Archived', 'Rejected', 'Expired'], default: 'Published' },
  visibility: { type: String, enum: ['Account', 'Locations'], default: 'Account' },
  featured: { type: Boolean, default: false },
  pinned: { type: Boolean, default: false },
  slug: { type: String, trim: true, maxlength: 160, default: '' },
  seoTitle: { type: String, trim: true, maxlength: 70, default: '' },
  seoDescription: { type: String, trim: true, maxlength: 160, default: '' },
  keywords: { type: [String], default: [], validate: [(value: string[]) => value.length <= 10, 'A maximum of 10 keywords is allowed'] },
  scheduledAt: { type: Date, default: null },
  publishedAt: { type: Date, default: null },
  commentsEnabled: { type: Boolean, default: true },
  reviewHistory: { type: [ReviewHistorySchema], default: [] },
  help: { type: Boolean, default: false },
  visible: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'UserModel' },
}, {
  collection: POST_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
});

PostSchema.index({ account_id: 1, visible: 1, createdAt: -1 });
PostSchema.index({ account_id: 1, visible: 1, status: 1, createdAt: -1 });
PostSchema.index({ account_id: 1, visible: 1, postType: 1, relatedTo: 1 });
PostSchema.index({ account_id: 1, publishTo: 1, visible: 1 });
PostSchema.index({ status: 1, visible: 1, scheduledAt: 1 });

export const PostModel = mongoose.model<IPost>('Schema_Post', PostSchema);
