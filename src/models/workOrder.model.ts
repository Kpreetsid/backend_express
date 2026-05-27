import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
import { historyPlugin } from './plugins/history.plugin';
import { HistoryWorkOrderModel } from './history-work-order.model';

export const WORK_ORDER_STATUSES = ['Open', 'Pending', 'Blocked', 'Waiting-on-Parts', 'Waiting-on-Permit', 'On-Hold', 'In-Progress', 'Approved', 'Rejected', 'Completed'];
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
  part_source?: 'manual' | 'procedure' | 'mixed';
  procedureNames?: string[];
  estimatedQuantity: number;
  actualQuantity: number;
  plannedQuantity?: number;
  reservedQuantity?: number;
  issuedQuantity?: number;
  returnedQuantity?: number;
  shortQuantity?: number;
  lifecycle_status?: 'planned' | 'reserved' | 'issued' | 'returned' | 'short';
  unit: string;
  cost: number;
  currency: string;
}

const PartsSchema = new Schema<IParts>({
  part_id: { type: Schema.Types.ObjectId, ref: 'PartModel', required: true }, 
  part_name: { type: String, trim: true, required: true },
  part_type: { type: String, trim: true, required: true },
  part_source: { type: String, enum: ['manual', 'procedure', 'mixed'], default: 'manual' },
  procedureNames: { type: [String], default: [] },
  estimatedQuantity: { type: Number, required: true },
  actualQuantity: { type: Number },
  plannedQuantity: { type: Number, default: 0 },
  reservedQuantity: { type: Number, default: 0 },
  issuedQuantity: { type: Number, default: 0 },
  returnedQuantity: { type: Number, default: 0 },
  shortQuantity: { type: Number, default: 0 },
  lifecycle_status: { type: String, enum: ['planned', 'reserved', 'issued', 'returned', 'short'], default: 'planned' },
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

export interface ILaborEntry {
  user_id?: ObjectId;
  vendor_name?: string;
  work_date?: Date;
  hours: number;
  notes?: string;
  user?: any;
}

const LaborEntrySchema = new Schema<ILaborEntry>({
  user_id: { type: Schema.Types.ObjectId, ref: 'Schema_User' },
  vendor_name: { type: String, trim: true },
  work_date: { type: Date },
  hours: { type: Number, required: true },
  notes: { type: String, trim: true }
}, { _id: false, versionKey: false });

export interface IProcedureExecutionEntry {
  procedure_id?: ObjectId;
  name: string;
  category?: string;
  tags?: string[];
  description?: string;
  steps: any[];
  responses?: Record<string, any>;
  score_summary?: {
    earned: number;
    possible: number;
    percentage?: number | null;
  };
  triggered_actions?: any[];
  submitted?: boolean;
  submitted_by?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  submitted_at?: Date;
}

const ProcedureExecutionEntrySchema = new Schema<IProcedureExecutionEntry>({
  procedure_id: { type: Schema.Types.ObjectId, ref: 'Schema_Procedure' },
  name: { type: String, trim: true, required: true },
  category: { type: String, trim: true },
  tags: { type: [String], default: [] },
  description: { type: String, trim: true },
  steps: { type: [Schema.Types.Mixed] as any, default: [] },
  responses: { type: Schema.Types.Mixed, default: {} },
  score_summary: { type: Schema.Types.Mixed },
  triggered_actions: { type: [Schema.Types.Mixed] as any, default: [] },
  submitted: { type: Boolean, default: false },
  submitted_by: {
    id: { type: String },
    firstName: { type: String },
    lastName: { type: String }
  },
  submitted_at: { type: Date }
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
  block_reason?: string;
  status_details: IStatusDetails[];
  type: string;
  createdFrom: string;
  nature_of_work: string;
  wo_asset_id?: ObjectId;
  wo_location_id: ObjectId;
  start_date: Date;
  end_date: Date;
  actual_start_date?: Date;
  actual_end_date?: Date;
  completed_at?: Date;
  completed_by?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  actual_time?: number;
  sop_form_id: ObjectId;
  procedure_ids?: ObjectId[];
  procedure_entries?: IProcedureExecutionEntry[];
  sop_form_submitted: boolean;
  sop_form_data: object;
  sop_form_updated_by?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  sop_form_updated_at?: Date;
  asset_report_id: ObjectId;
  cron_id: ObjectId;
  tasks: ITask[];
  parts: IParts[];
  labor_entries: ILaborEntry[];
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
  block_reason: { type: String, trim: true },
  status_details: { type: [StatusDetailsSchema], default: [] },
  type: { type: String, trim: true },
  nature_of_work: { type: String, trim: true },
  wo_asset_id: { type: Schema.Types.ObjectId, ref: 'AssetModel' },
  wo_location_id: { type: Schema.Types.ObjectId, ref: 'LocationModel', required: true },
  start_date: { type: Date },
  end_date: { type: Date },
  actual_start_date: { type: Date },
  actual_end_date: { type: Date },
  completed_at: { type: Date },
  completed_by: {
    id: { type: String },
    firstName: { type: String },
    lastName: { type: String }
  },
  actual_time: { type: Number },
  sop_form_id: { type: Schema.Types.ObjectId, ref: 'SOPFormModel' },
  procedure_ids: { type: [Schema.Types.ObjectId], ref: 'Schema_Procedure', default: [] },
  procedure_entries: { type: [ProcedureExecutionEntrySchema], default: [] },
  sop_form_submitted: { type: Boolean, default: false },
  sop_form_data: { type: Schema.Types.Mixed },
  sop_form_updated_by: {
    id: { type: String },
    firstName: { type: String },
    lastName: { type: String }
  },
  sop_form_updated_at: { type: Date },
  parts: { type: [PartsSchema] },
  tasks: { type: [TaskSchema], default: [] },
  labor_entries: { type: [LaborEntrySchema], default: [] },
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
