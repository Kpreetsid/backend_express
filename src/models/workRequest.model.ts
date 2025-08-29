import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface IWorkRequest extends Document {
  account_id: ObjectId;
  title: string;
  description: string;
  problemType: string;
  priority: string;
  locationId: ObjectId;
  assetId: ObjectId;
  files: string[];
  status?: string;
  emailId?: string;
  tags?: {
    id: string;
  };
  help?: boolean;
  comments?: any[];
  reject_reason?: string;
  likes?: any[];
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const WorkRequestSchema = new Schema<IWorkRequest>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  title: { type: String },
  description: { type: String, required: true },
  problemType: { type: String, required: true },
  priority: { type: String, enum: ['None', 'Low', 'Medium', 'High'], default: 'None' },
  files: { type: [String] },
  status: { type: String },
  emailId: { type: String },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
  tags: { type: Object },
  comments: { type: [Schema.Types.Mixed] },
  reject_reason: { type: String },
  likes: { type: [Schema.Types.Mixed] },
  visible: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  collection: 'work_request',
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

export const WorkRequestModel = mongoose.model<IWorkRequest>('Schema_WorkRequest', WorkRequestSchema);
