import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';
export const FORM_CATEGORY_COLLECTION_NAME = 'form_category';


export interface ICategory extends Document {
  name: string;
  description: string;
  visible: boolean;
  account_id: ObjectId;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000 },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  visible: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: FORM_CATEGORY_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
});

categorySchema.index({ account_id: 1, visible: 1, name: 1 });

export const CategoryModel = mongoose.model<ICategory>('Schema_Category', categorySchema);
