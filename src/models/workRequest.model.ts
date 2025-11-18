import mongoose, { Schema, Document, ObjectId } from 'mongoose';
import { IUpload } from './upload.model';

export const WORK_REQUEST_STATUSES = ['Open', 'Pending', 'On-Hold', 'In-Progress', 'Approved', 'Rejected'];
export const WORK_REQUEST_PRIORITIES = ['None', 'Low', 'Medium', 'High'];

export interface IWorkRequest extends Document {
  account_id: ObjectId;
  title: string;
  description: string;
  problemType: string;
  priority: string;
  location_id: ObjectId;
  asset_id: ObjectId;
  files: IUpload[];
  status: string;
  tags?: string[];
  remarks?: string;
  visible: boolean;
  approvedBy?: ObjectId;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const WorkRequestSchema = new Schema<IWorkRequest>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  title: { type: String, trim: true },
  description: { type: String, trim: true },
  problemType: { type: String, trim: true, required: true },
  priority: { type: String, trim: true, enum: WORK_REQUEST_PRIORITIES, default: 'None' },
  files: { type: [Object], default: [] },
  status: { type: String, trim: true, enum: WORK_REQUEST_STATUSES, default: 'Open' },
  location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel', required: true },
  asset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetModel', required: true },
  tags: { type: [String] },
  remarks: { type: String, trim: true },
  visible: { type: Boolean, default: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: 'work_request',
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc: any, ret: any) {
      ret.id = ret._id;
      delete (ret as any)._id;
      return ret;
    }
  }
});

export const WorkRequestModel = mongoose.model<IWorkRequest>('Schema_WorkRequest', WorkRequestSchema);
