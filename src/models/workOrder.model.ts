import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export const WORK_ORDER_STATUSES = ['Open', 'Pending', 'On-Hold', 'In-Progress', 'Approved', 'Rejected', 'Completed'];
export const WORK_ORDER_PRIORITIES = ['None', 'Low', 'Medium', 'High'];

export interface ITaskOption {
  key: string;
  value: string;  // "false" as string in your DB
}

export interface ITask {
  title: string;
  type: string;
  fieldValue: string;
  options: ITaskOption[];
}

const TaskOptionSchema = new Schema<ITaskOption>({
  key: { type: String },
  value: { type: String }
}, { _id: true });

const TaskSchema = new Schema<ITask>({
  title: { type: String },
  type: { type: String },
  fieldValue: { type: String },
  options: [TaskOptionSchema]
}, { _id: true, versionKey: false });

export interface IParts {
  part_id: ObjectId;
  part_name: string;
  part_type: string;
  estimatedQuantity: number;
  actualQuantity: number;
}

const PartsSchema = new Schema<IParts>({
  part_id: { type: Schema.Types.ObjectId, ref: 'PartModel' },
  part_name: { type: String, required: true },
  part_type: { type: String, required: true },
  estimatedQuantity: { type: Number, required: true },
  actualQuantity: { type: Number }
}, { _id: true, versionKey: false });




export interface IWorkOrder extends Document {
  account_id: ObjectId;
  order_no: string;
  title: string;
  description: string;
  estimated_time: number;
  priority: string;
  status: string;
  createdFrom?: string;
  type: string;
  wo_asset_id: ObjectId;
  wo_location_id: ObjectId;
  start_date: Date;
  end_date: Date;
  sop_form_id: ObjectId;
  work_instruction: ObjectId;
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
  order_no: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  estimated_time: { type: Number },
  createdFrom: { type: String },
  priority: { type: String, enum: WORK_ORDER_PRIORITIES, default: "None" },
  status: { type: String, enum: WORK_ORDER_STATUSES, default: "Open" },
  type: { type: String },
  wo_asset_id: { type: Schema.Types.ObjectId, ref: 'AssetModel', required: true },
  wo_location_id: { type: Schema.Types.ObjectId, ref: 'LocationModel', required: true },
  start_date: { type: Date },
  end_date: { type: Date },
  sop_form_id: { type: Schema.Types.ObjectId, ref: 'SOPFormModel' },
  work_instruction: { type: Schema.Types.ObjectId, ref: 'WorkInstructionModel' },
  tasks: [TaskSchema],
  parts: [PartsSchema],
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
