import mongoose, { Document, Schema } from 'mongoose';
import { WORK_ORDER_PRIORITIES } from './workOrder.model';
export const WORK_ORDER_TEMPLATE_COLLECTION_NAME = 'work_order_templates';


export const WORK_ORDER_TEMPLATE_MAINTENANCE_TYPES = ['Preventive', 'Reactive', 'Other'] as const;
export const WORK_ORDER_TEMPLATE_TIME_UNITS = ['minutes', 'hours', 'days', 'weeks'] as const;

export interface IWorkOrderTemplatePart {
  part_id?: mongoose.Types.ObjectId;
  part_name: string;
  part_number?: string;
  part_source?: 'manual' | 'procedure' | 'mixed';
  procedureNames?: string[];
  quantity: number;
  unit?: string;
  cost?: number;
  currency?: string;
}

export interface IWorkOrderTemplateFieldRule {
  hidden?: boolean;
  required?: boolean;
  read_only?: boolean;
}

export interface IWorkOrderTemplate extends Document {
  account_id: mongoose.Types.ObjectId;
  template_name: string;
  title: string;
  description?: string;
  estimated_time?: number;
  priority: string;
  nature_of_work?: string;
  maintenance_type: string;
  procedure_ids: mongoose.Types.ObjectId[];
  assignee_ids: mongoose.Types.ObjectId[];
  location_ids: mongoose.Types.ObjectId[];
  asset_ids: mongoose.Types.ObjectId[];
  parts: IWorkOrderTemplatePart[];
  categories: string[];
  vendors: string[];
  field_rules: Record<string, IWorkOrderTemplateFieldRule>;
  due_date_settings?: {
    due_after_value?: number | null;
    due_after_unit?: string | null;
    start_before_value?: number | null;
    start_before_unit?: string | null;
    recurrence_value?: number | null;
    recurrence_unit?: string | null;
  };
  visible: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

const TemplatePartSchema = new Schema<IWorkOrderTemplatePart>({
  part_id: { type: Schema.Types.ObjectId, ref: 'PartModel' },
  part_name: { type: String, trim: true, required: true, maxlength: 180 },
  part_number: { type: String, trim: true, maxlength: 120 },
  part_source: { type: String, enum: ['manual', 'procedure', 'mixed'], default: 'manual' },
  procedureNames: { type: [String], default: [] },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, trim: true, maxlength: 40 },
  cost: { type: Number, min: 0 },
  currency: { type: String, trim: true, minlength: 3, maxlength: 3, uppercase: true }
}, { _id: false, versionKey: false });

const FieldRuleSchema = new Schema<IWorkOrderTemplateFieldRule>({
  hidden: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  read_only: { type: Boolean, default: false }
}, { _id: false, versionKey: false });

const DueDateSettingsSchema = new Schema({
  due_after_value: { type: Number, default: null },
  due_after_unit: { type: String, enum: [...WORK_ORDER_TEMPLATE_TIME_UNITS, null], default: null },
  start_before_value: { type: Number, default: null },
  start_before_unit: { type: String, enum: [...WORK_ORDER_TEMPLATE_TIME_UNITS, null], default: null },
  recurrence_value: { type: Number, default: null },
  recurrence_unit: { type: String, enum: [...WORK_ORDER_TEMPLATE_TIME_UNITS, null], default: null }
}, { _id: false, versionKey: false });

const defaultFieldRules = () => ({
  description: { hidden: false, required: false, read_only: false },
  estimated_time: { hidden: false, required: false, read_only: false },
  procedures: { hidden: false, required: false, read_only: false },
  assignees: { hidden: false, required: false, read_only: false },
  priority: { hidden: false, required: false, read_only: false },
  locations: { hidden: false, required: false, read_only: false },
  assets: { hidden: false, required: false, read_only: false },
  parts: { hidden: false, required: false, read_only: false },
  categories: { hidden: false, required: false, read_only: false },
  vendors: { hidden: false, required: false, read_only: false }
});

const WorkOrderTemplateSchema = new Schema<IWorkOrderTemplate>({
  account_id: { type: Schema.Types.ObjectId, required: true, index: true },
  template_name: { type: String, trim: true, required: true, maxlength: 180 },
  title: { type: String, trim: true, required: true, maxlength: 180 },
  description: { type: String, trim: true, default: '', maxlength: 4000 },
  estimated_time: { type: Number, min: 0, default: null },
  priority: { type: String, trim: true, enum: WORK_ORDER_PRIORITIES, default: 'Medium' },
  nature_of_work: { type: String, trim: true, default: 'General', maxlength: 120 },
  maintenance_type: { type: String, enum: WORK_ORDER_TEMPLATE_MAINTENANCE_TYPES, default: 'Reactive' },
  procedure_ids: { type: [Schema.Types.ObjectId], ref: 'Schema_Procedure', default: [] },
  assignee_ids: { type: [Schema.Types.ObjectId], ref: 'Schema_User', default: [] },
  location_ids: { type: [Schema.Types.ObjectId], ref: 'LocationModel', default: [] },
  asset_ids: { type: [Schema.Types.ObjectId], ref: 'AssetModel', default: [] },
  parts: { type: [TemplatePartSchema], default: [] },
  categories: { type: [String], default: [] },
  vendors: { type: [String], default: [] },
  field_rules: {
    type: new Schema({
      description: { type: FieldRuleSchema, default: () => ({}) },
      estimated_time: { type: FieldRuleSchema, default: () => ({}) },
      procedures: { type: FieldRuleSchema, default: () => ({}) },
      assignees: { type: FieldRuleSchema, default: () => ({}) },
      priority: { type: FieldRuleSchema, default: () => ({}) },
      locations: { type: FieldRuleSchema, default: () => ({}) },
      assets: { type: FieldRuleSchema, default: () => ({}) },
      parts: { type: FieldRuleSchema, default: () => ({}) },
      categories: { type: FieldRuleSchema, default: () => ({}) },
      vendors: { type: FieldRuleSchema, default: () => ({}) }
    }, { _id: false, versionKey: false }),
    default: defaultFieldRules
  },
  due_date_settings: { type: DueDateSettingsSchema, default: () => ({}) },
  visible: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Schema_User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'Schema_User' }
}, {
  collection: WORK_ORDER_TEMPLATE_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
});

WorkOrderTemplateSchema.index({ account_id: 1, visible: 1, updatedAt: -1 });
WorkOrderTemplateSchema.index({ account_id: 1, visible: 1, maintenance_type: 1 });
WorkOrderTemplateSchema.index({ account_id: 1, visible: 1, template_name: 1 });

export const WorkOrderTemplateModel = mongoose.model<IWorkOrderTemplate>('Schema_WorkOrderTemplate', WorkOrderTemplateSchema);
