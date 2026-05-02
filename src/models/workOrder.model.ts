import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
import { historyPlugin } from './plugins/history.plugin';
import { HistoryWorkOrderModel } from './history-work-order.model';

export const WORK_ORDER_STATUSES = ['Open', 'Pending', 'On-Hold', 'In-Progress', 'Approved', 'Rejected', 'Completed'];
export const WORK_ORDER_PRIORITIES = ['None', 'Low', 'Medium', 'High', 'Urgent'];
export const TASK_STATUSES = ['Open', 'In-Progress', 'On-Hold', 'Completed'];

export interface ITask {
  title: string;
  priority: string;
  assigned_user_id?: ObjectId;
  status: string;
  completed: boolean;
  completedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  completedAt?: Date;
  updatedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  updatedAt?: Date;
  assignedUser?: any;
}

const TaskSchema = new Schema<ITask>({
  title: { type: String, required: true },
  priority: { type: String, enum: WORK_ORDER_PRIORITIES, default: 'Medium' },
  assigned_user_id: { type: Schema.Types.ObjectId, ref: 'Schema_User' },
  status: { type: String, enum: TASK_STATUSES, default: 'Open' },
  completed: { type: Boolean, default: false },
  completedBy: {
    id: { type: String },
    firstName: { type: String },
    lastName: { type: String }
  },
  completedAt: { type: Date },
  updatedBy: {
    id: { type: String },
    firstName: { type: String },
    lastName: { type: String }
  },
  updatedAt: { type: Date }
}, { _id: false, versionKey: false });

export interface IParts {
  part_id: ObjectId;
  part_name: string;
  part_type: string;
  estimatedQuantity: number;
  actualQuantity: number;
  unit: string;
  cost: number;
  currency: string;
}

const PartsSchema = new Schema<IParts>({
  part_id: { type: Schema.Types.ObjectId, ref: 'PartModel', required: true }, 
  part_name: { type: String, trim: true, required: true },
  part_type: { type: String, trim: true, required: true },
  estimatedQuantity: { type: Number, required: true },
  actualQuantity: { type: Number },
  unit: { type: String, trim: true },
  cost: { type: Number },
  currency: { type: String, trim: true }
}, { _id: false, versionKey: false });

interface IStatusDetails {
  status: string;
  createdBy: ObjectId;
  createdAt: Date;
}

const StatusDetailsSchema = new Schema<IStatusDetails>({
  status: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Schema_User', required: true },
  createdAt: { type: Date, required: true, default: Date.now }
}, { _id: false, versionKey: false });

export interface IWorkOrder extends Document {
  account_id: ObjectId;
  order_no: string;
  title: string;
  description: string;
  estimated_time: number;
  priority: string;
  status: string;
  parentId?: ObjectId;
  status_details: IStatusDetails[];
  type: string;
  createdFrom: string;
  nature_of_work: string;
  wo_asset_id: ObjectId;
  wo_location_id: ObjectId;
  start_date: Date;
  end_date: Date;
  sop_form_id: ObjectId;
  sop_form_submitted: boolean;
  sop_form_data: object;
  asset_report_id: ObjectId;
  cron_id: ObjectId;
  tasks: ITask[];
  parts: IParts[];
  work_request_id: ObjectId;
  files: object[];
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const WorkOrderSchema = new Schema<IWorkOrder>({
  account_id: { type: Schema.Types.ObjectId, required: true },
  order_no: { type: String, trim: true, required: true },
  title: { type: String, trim: true, required: true },
  description: { type: String, trim: true },
  estimated_time: { type: Number },
  createdFrom: { type: String, trim: true, enum: [ 'Asset Report', 'Work Request', 'Work Order', 'Preventive'], default: "Work Order" },
  priority: { type: String, trim: true, enum: WORK_ORDER_PRIORITIES, default: "Low" },
  status: { type: String, trim: true, enum: WORK_ORDER_STATUSES, default: "Open" },
  parentId: { type: Schema.Types.ObjectId, ref: 'Schema_WorkOrder' },
  status_details: { type: [StatusDetailsSchema], default: [] },
  type: { type: String, trim: true },
  nature_of_work: { type: String, trim: true },
  wo_asset_id: { type: Schema.Types.ObjectId, ref: 'AssetModel', required: true },
  wo_location_id: { type: Schema.Types.ObjectId, ref: 'LocationModel', required: true },
  start_date: { type: Date },
  end_date: { type: Date },
  sop_form_id: { type: Schema.Types.ObjectId, ref: 'SOPFormModel' },
  sop_form_submitted: { type: Boolean, default: false },
  sop_form_data: { type: Schema.Types.Mixed },
  parts: { type: [PartsSchema] },
  tasks: { type: [TaskSchema], default: [] },
  asset_report_id: { type: Schema.Types.ObjectId, ref: 'AssetReportModel' },
  work_request_id: { type: Schema.Types.ObjectId, ref: 'WorkRequestModel' },
  files: { type: [Object] },
  visible: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Schema_User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'Schema_User' }
}, {
  collection: 'work_orders',
  timestamps: true,
  versionKey: false
});

WorkOrderSchema.index({ account_id: 1, visible: 1, createdAt: -1 });
WorkOrderSchema.index({ account_id: 1, visible: 1, status: 1 });
WorkOrderSchema.index({ account_id: 1, visible: 1, priority: 1 });
WorkOrderSchema.index({ wo_asset_id: 1, visible: 1 });
WorkOrderSchema.index({ wo_location_id: 1, visible: 1 });
WorkOrderSchema.index({ parentId: 1 });
WorkOrderSchema.index({ order_no: 1 });
WorkOrderSchema.index({ createdBy: 1 });

WorkOrderSchema.plugin(historyPlugin, {
  historyModel: HistoryWorkOrderModel
});

export const WorkOrderModel = mongoose.model<IWorkOrder>('Schema_WorkOrder', WorkOrderSchema);
