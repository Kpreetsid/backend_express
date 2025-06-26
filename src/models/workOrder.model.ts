import mongoose, { Schema, Document, ObjectId } from 'mongoose';

interface ILocation {
  location_name: string;
  assigned_to: string;
  id: string;
}

interface IEstimatedPart {
  data: {
    part_name: string;
    description: string;
    part_number: string;
    quantity: number;
    min_quantity: number;
    cost: number;
    part_type: string;
    id: string;
    account_id: string;
    locationId: string;
    location: ILocation;
  };
  selected_quantity: number;
}

export interface IWorkOrder extends Document {
  account_id: ObjectId;
  order_no: string;
  title: string;
  description: string;
  estimated_time: string;
  priority: string;
  status: string;
  nature_of_work: string;
  rescheduleEnabled: boolean;
  wo_asset_id: ObjectId;
  wo_location_id: ObjectId;
  assigned_to: number;
  start_date: string;
  end_date: string;
  sopForm: string | null;
  teamId: string | null;
  workInstruction: string | null;
  actualParts: string[];
  createdFrom: string;
  createrEmail: string;
  requestId: string;
  attachment: string[];
  estimatedParts: IEstimatedPart[];
  visible: boolean;
  created_by: ObjectId;
  createdOn: Date;
}

const locationSchema = new Schema<ILocation>({
  location_name: String,
  assigned_to: String,
  id: String
}, { _id: false });

const estimatedPartSchema = new Schema<IEstimatedPart>({
  data: {
    part_name: String,
    description: String,
    part_number: String,
    quantity: Number,
    min_quantity: Number,
    cost: Number,
    part_type: String,
    id: String,
    account_id: String,
    locationId: String,
    location: locationSchema
  },
  selected_quantity: Number
}, { _id: false });

const WorkOrderSchema = new Schema<IWorkOrder>({
  account_id: { type: Schema.Types.ObjectId, required: true },
  order_no: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  estimated_time: { type: String },
  priority: { type: String, enum: ["None", "Low", "Medium", "High"], default: "None" },
  status: { type: String, enum: ["Open", "In-Progress", "On-Hold", "Completed"], default: "Open" },
  nature_of_work: { type: String },
  rescheduleEnabled: { type: Boolean, default: false },
  wo_asset_id: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
  wo_location_id: { type: Schema.Types.ObjectId, ref: 'LocationMaster', required: true },
  assigned_to: { type: Number },
  start_date: { type: String },
  end_date: { type: String },
  sopForm: { type: String },
  teamId: { type: String },
  workInstruction: { type: String },
  actualParts: { type: [String] },
  createdFrom: { type: String },
  createrEmail: { type: String },
  requestId: { type: String },
  attachment: { type: [String] },
  estimatedParts: { type: [estimatedPartSchema] },
  visible: { type: Boolean, default: true },
  created_by: { type: Schema.Types.ObjectId, required: true },
  createdOn: { type: Date, default: Date.now }
}, {
  collection: 'work_orders',
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  }
});

export const WorkOrder = mongoose.model<IWorkOrder>('WorkOrder', WorkOrderSchema);
