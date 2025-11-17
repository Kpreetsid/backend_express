import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  description: string;
  visible: boolean;
  account_id: ObjectId;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  visible: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }
}, {
  collection: 'form_category',
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

export const CategoryModel = mongoose.model<ICategory>('Schema_Category', categorySchema);
