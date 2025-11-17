import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export const WORK_ORDER_STATUSES = ['Open', 'Pending', 'On-Hold', 'In-Progress', 'Approved', 'Rejected', 'Completed'];
export const WORK_ORDER_PRIORITIES = ['None', 'Low', 'Medium', 'High'];

export interface IParts {
  part_id: ObjectId;
  part_name: string;
  part_type: string;
  estimatedQuantity: number;
  actualQuantity: number;
  unit: string;
}

const PartsSchema = new Schema<IParts>({
  part_id: { type: Schema.Types.ObjectId, ref: 'PartModel', required: true }, 
  part_name: { type: String, trim: true, required: true },
  part_type: { type: String, trim: true, required: true },
  estimatedQuantity: { type: Number, required: true },
  actualQuantity: { type: Number },
  unit: { type: String, trim: true },
}, { _id: false, versionKey: false });

export interface IWorkOrder extends Document {
  account_id: ObjectId;
  order_no: string;
  title: string;
  description: string;
  estimated_time: number;
  priority: string;
  status: string;
  type: string;
  createdFrom: string;
  nature_of_work: string;
  wo_asset_id: ObjectId;
  wo_location_id: ObjectId;
  start_date: Date;
  end_date: Date;
  sop_form_id: ObjectId;
  sop_form_data: object;
  asset_report_id: ObjectId;
  cron_id: ObjectId;
  tasks: object[];
  task_submitted: boolean;
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
  createdFrom: { type: String, trim: true, enum: ['Work Request', 'Work Order', 'Preventive'], default: "Work Order" },
  priority: { type: String, trim: true, enum: WORK_ORDER_PRIORITIES, default: "None" },
  status: { type: String, trim: true, enum: WORK_ORDER_STATUSES, default: "Open" },
  type: { type: String, trim: true },
  nature_of_work: { type: String, trim: true },
  wo_asset_id: { type: Schema.Types.ObjectId, ref: 'AssetModel', required: true },
  wo_location_id: { type: Schema.Types.ObjectId, ref: 'LocationModel', required: true },
  start_date: { type: Date },
  end_date: { type: Date },
  sop_form_id: { type: Schema.Types.ObjectId, ref: 'SOPFormModel' },
  sop_form_data: { type: Schema.Types.Mixed },
  parts: { type: [PartsSchema] },
  tasks: { type: [Object] },
  task_submitted: { type: Boolean, default: false },
  asset_report_id: { type: Schema.Types.ObjectId, ref: 'AssetReportModel' },
  work_request_id: { type: Schema.Types.ObjectId, ref: 'WorkRequestModel' },
  files: { type: [Object] },
  visible: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: 'work_orders',
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

export const WorkOrderModel = mongoose.model<IWorkOrder>('Schema_WorkOrder', WorkOrderSchema);
