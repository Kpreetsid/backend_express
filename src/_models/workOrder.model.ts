import mongoose, { Schema, Document } from 'mongoose';

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
  order_no: string;
  title: string;
  description: string;
  estimated_time: string;
  priority: string;
  status: string;
  nature_of_work: string;
  rescheduleEnabled: boolean;
  createdOn: Date;
  visible: boolean;
  account_id: mongoose.Types.ObjectId;
  created_by: mongoose.Types.ObjectId;
  wo_asset_id: mongoose.Types.ObjectId;
  wo_location_id: mongoose.Types.ObjectId;
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
  order_no: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  estimated_time: { type: String },
  priority: { type: String },
  status: { type: String },
  nature_of_work: { type: String },
  rescheduleEnabled: { type: Boolean, default: false },
  createdOn: { type: Date, default: Date.now },
  visible: { type: Boolean, default: true },
  account_id: { type: Schema.Types.ObjectId, required: true },
  created_by: { type: Schema.Types.ObjectId, required: true },
  wo_asset_id: { type: Schema.Types.ObjectId, required: true },
  wo_location_id: { type: Schema.Types.ObjectId, required: true },
  assigned_to: { type: Number },
  start_date: { type: String },
  end_date: { type: String },
  sopForm: { type: String, default: null },
  teamId: { type: String, default: null },
  workInstruction: { type: String, default: null },
  actualParts: { type: [String], default: [] },
  createdFrom: { type: String },
  createrEmail: { type: String },
  requestId: { type: String },
  attachment: { type: [String], default: [] },
  estimatedParts: { type: [estimatedPartSchema], default: [] }
}, {
  collection: 'work_orders',
  timestamps: true
});

export const WorkOrder = mongoose.model<IWorkOrder>('WorkOrder', WorkOrderSchema);
