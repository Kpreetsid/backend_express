import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
import { IUpload } from './upload.model';
import { syncVersionPlugin } from './plugins/sync-version.plugin';

export const WORK_REQUEST_COLLECTION_NAME = 'work_request';

export const WORK_REQUEST_STATUSES = ['Open', 'Pending', 'On-Hold', 'In-Progress', 'Approved', 'Rejected'];
export const WORK_REQUEST_PRIORITIES = ['None', 'Low', 'Medium', 'High', 'Urgent'];
export const WORK_REQUEST_REVIEW_SLA_HOURS: Record<string, number> = {
  None: 96,
  Low: 72,
  Medium: 24,
  High: 8,
  Urgent: 2
};
export const WORK_REQUEST_ORDER_SLA_HOURS: Record<string, number> = {
  None: 168,
  Low: 120,
  Medium: 72,
  High: 24,
  Urgent: 8
};

export interface IWorkRequest extends Document {
  sync_version: number;
  account_id: ObjectId;
  request_no: string;
  title: string;
  description: string;
  problemType: string;
  priority: string;
  location_id: ObjectId;
  asset_id?: ObjectId | null;
  files: IUpload[];
  status: string;
  tags?: string[];
  remarks?: string;
  review_sla_hours?: number;
  review_due_at?: Date;
  order_sla_hours?: number;
  order_due_at?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  convertedAt?: Date;
  converted_order_no?: string;
  converted_work_order_id?: ObjectId;
  rejectedBy?: ObjectId;
  convertedBy?: ObjectId;
  visible: boolean;
  approvedBy?: ObjectId;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const WorkRequestSchema = new Schema<IWorkRequest>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  request_no: { type: String, trim: true, required: true },
  title: { type: String, trim: true },
  description: { type: String, trim: true },
  problemType: { type: String, trim: true, required: true },
  priority: { type: String, trim: true, enum: WORK_REQUEST_PRIORITIES, default: 'Low' },
  files: { type: [Object], default: [] },
  status: { type: String, trim: true, enum: WORK_REQUEST_STATUSES, default: 'Open' },
  location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel', required: true },
  asset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetModel' },
  tags: { type: [String] },
  remarks: { type: String, trim: true },
  review_sla_hours: { type: Number },
  review_due_at: { type: Date },
  order_sla_hours: { type: Number },
  order_due_at: { type: Date },
  approvedAt: { type: Date },
  rejectedAt: { type: Date },
  convertedAt: { type: Date },
  converted_order_no: { type: String, trim: true },
  converted_work_order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Schema_WorkOrder' },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' },
  convertedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' },
  visible: { type: Boolean, default: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: WORK_REQUEST_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
});

WorkRequestSchema.plugin(syncVersionPlugin);
WorkRequestSchema.index({ account_id: 1, visible: 1, createdAt: -1 });
WorkRequestSchema.index({ account_id: 1, status: 1 });
WorkRequestSchema.index({ account_id: 1, location_id: 1 });

export const WorkRequestModel = mongoose.model<IWorkRequest>('Schema_WorkRequest', WorkRequestSchema);
