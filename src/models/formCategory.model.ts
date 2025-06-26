import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  description: string;
  visible: boolean;
  account_id: ObjectId;
  createdBy: ObjectId;
}

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true },
  description: { type: String },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  visible: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  collection: 'form_category',
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

export const Category = mongoose.model<ICategory>('Category', categorySchema);
