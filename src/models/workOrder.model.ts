import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export const WORK_ORDER_STATUSES = ['Open', 'Pending', 'On-Hold', 'In-Progress', 'Approved', 'Rejected', 'Completed'];
export const WORK_ORDER_PRIORITIES = ['None', 'Low', 'Medium', 'High'];

interface IUsedParts {
  part_id: ObjectId;
  quantity: number;
}

interface IParts {
  estimated: IUsedParts[];
  actual: IUsedParts[];
}

const PartsSchema = new Schema<IParts>({
  estimated: [{ part_id: { type: Schema.Types.ObjectId, ref: 'PartModel' }, quantity: { type: Number, required: true } }, { _id: false, versionKey: false }],
  actual: [{ part_id: { type: Schema.Types.ObjectId, ref: 'PartModel' }, quantity: { type: Number, required: true } }, { _id: false, versionKey: false }]
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
  asset_id: ObjectId;
  location_id: ObjectId;
  start_date: Date;
  end_date: Date;
  sop_form_id: ObjectId;
  work_instruction: ObjectId;
  comment_id: ObjectId;
  cron_id: ObjectId;
  task_id: ObjectId;
  parts: IParts;
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
  priority: { type: String, enum: WORK_ORDER_PRIORITIES, default: "None" },
  status: { type: String, enum: WORK_ORDER_STATUSES, default: "Open" },
  type: { type: String },
  asset_id: { type: Schema.Types.ObjectId, ref: 'AssetModel', required: true },
  location_id: { type: Schema.Types.ObjectId, ref: 'LocationModel', required: true },
  start_date: { type: Date },
  end_date: { type: Date },
  sop_form_id: { type: Schema.Types.ObjectId, ref: 'SOPFormModel' },
  work_instruction: { type: Schema.Types.ObjectId, ref: 'WorkInstructionModel' },
  parts: { type: PartsSchema },
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
