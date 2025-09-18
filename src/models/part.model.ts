import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface IPart extends Document {
  part_name: string;
  description: string;
  part_number: string;
  quantity: number;
  min_quantity: number;
  cost: number;
  part_type: string;
  account_id: ObjectId;
  locationId: ObjectId;
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId
}

const partSchema = new Schema<IPart>({
  part_name: { type: String, required: true },
  description: { type: String },
  part_number: { type: String, required: true },
  quantity: { type: Number, required: true },
  min_quantity: { type: Number, required: true },
  cost: { type: Number, required: true },
  part_type: { type: String, required: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationModel', required: true },
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
      delete ret._id;
      return ret;
    }
  }
});

export const PartsModel = mongoose.model<IPart>('Schema_Part', partSchema);