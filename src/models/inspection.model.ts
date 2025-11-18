import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface IInspection extends Document {
  account_id: ObjectId;
  title: string;
  description: string;
  start_date: string;
  form_id: ObjectId;
  inspection_report: Object;
  location_id: ObjectId;
  formCategory: ObjectId;
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
    formCategory: { type: String, required: true, trim: true },
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
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete (ret as any)._id;
        return ret;
      }
    }
  }
);

export const InspectionModel = mongoose.model<IInspection>('Schema_Inspection', InspectionSchema);