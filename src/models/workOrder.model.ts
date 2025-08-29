import mongoose, { Schema, Document, ObjectId } from 'mongoose';

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
  parts: object[];
  request_id: ObjectId;
  attachment: object[];
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
  priority: { type: String, enum: ["None", "Low", "Medium", "High"], default: "None" },
  status: { type: String, enum: ["Open", "In-Progress", "On-Hold", "Completed"], default: "Open" },
  type: { type: String },
  asset_id: { type: Schema.Types.ObjectId, ref: 'AssetModel', required: true },
  location_id: { type: Schema.Types.ObjectId, ref: 'LocationModel', required: true },
  start_date: { type: Date },
  end_date: { type: Date },
  task_id: { type: Schema.Types.ObjectId, ref: 'TaskModel' },
  sop_form_id: { type: Schema.Types.ObjectId, ref: 'SOPFormModel' },
  work_instruction: { type: Schema.Types.ObjectId, ref: 'WorkInstructionModel' },
  parts: { type: [Object] },
  request_id: { type: Schema.Types.ObjectId, ref: 'WorkRequestModel' },
  attachment: { type: [Object] },
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

export const WorkOrderModel = mongoose.model<IWorkOrder>('WorkOrder', WorkOrderSchema);
