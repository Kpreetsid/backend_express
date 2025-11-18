import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface IPart extends Document {
  account_id: ObjectId;
  part_name: string;
  part_number: string;
  part_type: string;
  unit: string;
  description: string;
  quantity: number;
  min_quantity: number;
  cost: number;
  location_id: ObjectId;
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId
}

const partSchema = new Schema<IPart>({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  part_name: { type: String, required: true, trim: true },
  part_number: { type: String, required: true, trim: true },
  part_type: { type: String, trim: true, required: true },
  unit: { type: String, trim: true, required: true },
  description: { type: String, trim: true },
  quantity: { type: Number, required: true },
  min_quantity: { type: Number, required: true },
  cost: { type: Number, required: true },
  location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel', required: true },
  visible: { type: Boolean, required: true, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: 'parts',
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc: any, ret: any) {
      ret.id = ret._id;
      delete (ret as any)._id;
      return ret;
    }
  }
});

export const PartsModel = mongoose.model<IPart>('Schema_Part', partSchema);