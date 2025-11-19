import mongoose, { Schema, Document, ObjectId } from 'mongoose';
import Joi from 'joi';
const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

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
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

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
    visible: { type: Boolean, required: true, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
  },
  {
    collection: 'mst_inspection',
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      }
    }
  }
);

export const InspectionModel = mongoose.model<IInspection>('Schema_Inspection', InspectionSchema);

export const createInspectionSchema = Joi.object({
  title: Joi.string().min(2).required(),
  description: Joi.string().allow("", null),
  start_date: Joi.string().required(),
  form_id: objectId.required(),
  inspection_report: Joi.object().allow(null),
  location_id: objectId.required(),
  asset_id: objectId.required(),
  assignedUser: Joi.array().items(objectId).required().min(1),
  status: Joi.string().required(),
  month: Joi.string(),
  createdFrom: Joi.string().required(),
  no_of_actions: Joi.number().min(0).default(0)
});

export const updateInspectionSchema = Joi.object({
  title: Joi.string().min(2),
  description: Joi.string().allow("", null),
  start_date: Joi.string(),
  form_id: objectId,
  inspection_report: Joi.object(),
  location_id: objectId,
  asset_id: objectId,
  assignedUser: Joi.array().items(objectId),
  status: Joi.string(),
  month: Joi.string(),
  createdFrom: Joi.string(),
  no_of_actions: Joi.number().min(0)
});