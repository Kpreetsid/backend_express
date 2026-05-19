import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from 'mongodb';

export const PROCEDURE_ITEM_TYPES = ['heading', 'section', 'field'] as const;
export const PROCEDURE_FIELD_TYPES = ['checkbox', 'text', 'number', 'multiple-choice', 'checklist', 'inspection-check', 'yes-no-na', 'date'] as const;

export interface IProcedureItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  field_type?: string;
  required?: boolean;
  options?: string[];
  include_time?: boolean;
  items?: IProcedureItem[];
}

export interface IProcedure extends Document {
  account_id: ObjectId;
  name: string;
  category?: string;
  tags?: string[];
  description?: string;
  steps: IProcedureItem[];
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const ProcedureSchema = new Schema<IProcedure>(
  {
    account_id: { type: Schema.Types.ObjectId, ref: 'AccountModel', required: true },
    name: { type: String, trim: true, required: true },
    category: { type: String, trim: true },
    tags: { type: [String], default: [] },
    description: { type: String, trim: true },
    steps: { type: [Schema.Types.Mixed] as any, default: [] },
    visible: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'UserModel', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'UserModel' }
  },
  {
    collection: 'procedures',
    timestamps: true,
    versionKey: false
  }
);

ProcedureSchema.index({ account_id: 1, visible: 1, createdAt: -1 });
ProcedureSchema.index({ account_id: 1, visible: 1, name: 1 });

export const ProcedureModel = mongoose.model<IProcedure>('Schema_Procedure', ProcedureSchema);
