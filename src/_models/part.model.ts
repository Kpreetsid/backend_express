import mongoose, { Schema, Document } from 'mongoose';

export interface IPart extends Document {
  part_name: string;
  description: string;
  part_number: string;
  quantity: number;
  min_quantity: number;
  cost: number;
  part_type: string;
  account_id: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  id?: mongoose.Types.ObjectId;
}

const partSchema = new Schema<IPart>({
  part_name: { type: String, required: true },
  description: { type: String, default: '' },
  part_number: { type: String, required: true },
  quantity: { type: Number, required: true },
  min_quantity: { type: Number, required: true },
  cost: { type: Number, required: true },
  part_type: { type: String, required: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationMaster', required: true },
  id: { type: mongoose.Schema.Types.ObjectId, default: null }
}, {
  collection: 'parts',
  timestamps: true
});

export const Part = mongoose.model<IPart>('Part', partSchema);
