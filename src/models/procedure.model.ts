import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from 'mongodb';

export const PROCEDURE_ITEM_TYPES = ['heading', 'section', 'field'] as const;
export const PROCEDURE_FIELD_TYPES = ['checkbox', 'text', 'number', 'multiple-choice', 'checklist', 'inspection-check', 'yes-no-na', 'date'] as const;

export interface IProcedureVisibilityCondition {
  step_id?: string;
  values?: string[];
}

export interface IProcedureCorrectiveAction {
  id: string;
  title: string;
  description?: string;
  trigger_values?: string[];
  priority?: string;
}

export interface IProcedureRequiredPart {
  part_id?: ObjectId;
  part_name: string;
  part_number?: string;
  barcode?: string;
  quantity: number;
  unit?: string;
  notes?: string;
}

export interface IProcedureItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  field_type?: string;
  required?: boolean;
  options?: string[];
  scoring_enabled?: boolean;
  option_scores?: number[];
  visibility_condition?: IProcedureVisibilityCondition;
  corrective_actions?: IProcedureCorrectiveAction[];
  include_time?: boolean;
  items?: IProcedureItem[];
}

export interface IProcedure extends Document {
  account_id: ObjectId;
  name: string;
  category?: string;
  tags?: string[];
  location_ids?: ObjectId[];
  asset_ids?: ObjectId[];
  description?: string;
  required_parts?: IProcedureRequiredPart[];
  steps: IProcedureItem[];
  version_group_id: ObjectId;
  version: number;
  is_latest: boolean;
  version_notes?: string;
  supersedes_id?: ObjectId;
  published_at?: Date;
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
    location_ids: { type: [Schema.Types.ObjectId], ref: 'Schema_Location', default: [] },
    asset_ids: { type: [Schema.Types.ObjectId], ref: 'Schema_Asset', default: [] },
    description: { type: String, trim: true },
    required_parts: { type: [Schema.Types.Mixed] as any, default: [] },
    steps: { type: [Schema.Types.Mixed] as any, default: [] },
    version_group_id: { type: Schema.Types.ObjectId, required: true },
    version: { type: Number, default: 1 },
    is_latest: { type: Boolean, default: true },
    version_notes: { type: String, trim: true },
    supersedes_id: { type: Schema.Types.ObjectId, ref: 'Schema_Procedure' },
    published_at: { type: Date, default: Date.now },
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
ProcedureSchema.index({ account_id: 1, visible: 1, version_group_id: 1, version: -1 });
ProcedureSchema.index({ account_id: 1, visible: 1, is_latest: 1 });
ProcedureSchema.index({ location_ids: 1 });
ProcedureSchema.index({ asset_ids: 1 });

export const ProcedureModel = mongoose.model<IProcedure>('Schema_Procedure', ProcedureSchema);
