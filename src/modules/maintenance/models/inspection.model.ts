import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const INSPECTION_COLLECTION_NAME = 'mst_inspection';


export interface IInspection extends Document {
  account_id: ObjectId;
  title: string;
  description: string;
  start_date: string;
  form_id: ObjectId;
  inspection_report: Object;
  location_id: ObjectId;
  asset_id: ObjectId;
  status: string;
  month: string;
  createdFrom: string;
  no_of_actions: number;
  corrective_actions: Array<{
    finding_key: string;
    work_order_id: ObjectId;
    order_no?: string;
    createdBy: ObjectId;
    createdAt: Date;
  }>;
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const CorrectiveActionSchema = new Schema({
  finding_key: { type: String, required: true, trim: true, maxlength: 160 },
  work_order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Schema_WorkOrder', required: true },
  order_no: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  createdAt: { type: Date, required: true, default: Date.now }
}, { _id: false, versionKey: false });

const InspectionSchema = new Schema<IInspection>(
  {
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    start_date: { type: String, required: true, trim: true },
    form_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SOPsModel', required: true },
    inspection_report: { type: Object },
    location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel', required: true },
    asset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetModel', required: true },
    status: { type: String, required: true, trim: true },
    month: { type: String, required: true, trim: true },
    createdFrom: { type: String, required: true, trim: true },
    no_of_actions: { type: Number, required: true, default: 0 },
    corrective_actions: { type: [CorrectiveActionSchema], default: [] },
    visible: { type: Boolean, required: true, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
  },
  {
    collection: INSPECTION_COLLECTION_NAME,
    timestamps: true,
    versionKey: false
  }
);

InspectionSchema.index({ account_id: 1, visible: 1 });
InspectionSchema.index({ account_id: 1, location_id: 1 });

export const InspectionModel = mongoose.model<IInspection>('Schema_Inspection', InspectionSchema);