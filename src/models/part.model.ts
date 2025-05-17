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
  id?: ObjectId;
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
  timestamps: true,
  versionKey: false
});

export const Part = mongoose.model<IPart>('Part', partSchema);

export const getAllPart = async (accountId: string) => await Part.find({ account_id: accountId }).sort({ _id: -1 });

export const getPartById = async (id: string) => await Part.findById(id);

export const getPartByFilter = async (accountId: string, filter: any) => await Part.find({ account_id: accountId, ...filter, visible: true }).sort({ _id: -1 });

export const createPart = async (part: IPart) => await Part.create(part);

export const updatePart = async (id: string, part: IPart) => await Part.findByIdAndUpdate({ id }, { $set: part });

export const deletePart = async (id: string) => await Part.findByIdAndUpdate({ _id: id }, { $set: { visible: false } });