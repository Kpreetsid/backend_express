import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  visible: boolean;
  account_id: ObjectId;
  id?: ObjectId;
}

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true },
  visible: { type: Boolean, required: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  id: { type: mongoose.Schema.Types.ObjectId, default: null }
}, {
  collection: 'form_category',
  timestamps: true,
  versionKey: false
});

export const Category = mongoose.model<ICategory>('Category', categorySchema);
