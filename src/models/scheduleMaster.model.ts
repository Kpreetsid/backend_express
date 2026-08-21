import mongoose, { Document, Schema } from "mongoose";
import { ObjectId } from 'mongodb';

interface IPart {
  part_id: string;
  part_name: string;
  part_type: string;
  part_source?: 'manual' | 'procedure' | 'mixed';
  procedureNames?: string[];
  estimatedQuantity: number;
  unit: string;
  cost: number;
  currency: string;
}

const PartSchema = new Schema<IPart>({
  part_id: { type: String, required: true },
  part_name: { type: String, trim: true, required: true },
  part_type: { type: String, trim: true, required: true },
  part_source: { type: String, enum: ['manual', 'procedure', 'mixed'], default: 'manual' },
  procedureNames: { type: [String], default: [] },
  estimatedQuantity: { type: Number, required: true },
  unit: { type: String, trim: true },
  cost: { type: Number },
  currency: { type: String, trim: true }
}, { _id: false });

interface WorkOrder {
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  estimated_time: number;
  wo_location_id: ObjectId;
  wo_asset_id?: ObjectId | null;
  sop_form_id?: ObjectId;
  userIdList: string[];
  tasks: Object[];
  parts: IPart[];
  createdFrom?: string;
}

const WorkOrderSchema = new Schema<WorkOrder>({
  title: { type: String, trim: true, required: true },
  description: { type: String, trim: true },
  type: { type: String, trim: true, required: true },
  status: { type: String, trim: true, required: true },
  priority: { type: String, trim: true, required: true },
  estimated_time: Number,
  wo_location_id: { type: Schema.Types.ObjectId, ref: "LocationModel", required: true },
  wo_asset_id: { type: Schema.Types.ObjectId, ref: "AssetModel" },
  sop_form_id: { type: Schema.Types.ObjectId, ref: "SopFormModel" },
  userIdList: { type: [String], required: true },
  tasks: { type: [Object], default: [] },
  parts: { type: [PartSchema], default: [] },
  createdFrom: { type: String, trim: true }
}, { _id: false });

interface ScheduleRepeatDaily {
  everyNDays: number;
}

const ScheduleRepeatDailySchema = new Schema<ScheduleRepeatDaily>({
  everyNDays: { type: Number, default: 1 }
}, { _id: false });

interface ScheduleRepeatWeekly {
  everyNWeeks: number;
  days: string[];
}

const ScheduleRepeatWeeklySchema = new Schema<ScheduleRepeatWeekly>({
  everyNWeeks: { type: Number, default: 1 },
  days: { type: [String], default: [] }
}, { _id: false });

interface ScheduleRepeatMonthly {
  everyNMonths: number;
  monthDays: number[];
}

const ScheduleRepeatMonthlySchema = new Schema<ScheduleRepeatMonthly>({
  everyNMonths: { type: Number, default: 1 },
  monthDays: { type: [Number], default: [] }
}, { _id: false });

interface ISchedule {
  mode: "daily" | "weekly" | "monthly";
  enabled: boolean;
  start_date: string;
  end_date?: string | null;
  no_of_repetition: number | null;
  no_of_execution: number;
  skipWeekends: boolean;
  skipWeekendSaturday: boolean;
  skipWeekendSunday: boolean;
  skipDates: string[];
  daily: ScheduleRepeatDaily;
  weekly: ScheduleRepeatWeekly;
  monthly: ScheduleRepeatMonthly;
  last_execution_date: Date | null;
}

const ScheduleSchema = new Schema<ISchedule>({
  mode: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
  enabled: { type: Boolean, default: true },
  start_date: { type: String, required: true },
  end_date: { type: String },
  no_of_repetition: { type: Number },
  no_of_execution: { type: Number, default: 0 },
  skipWeekends: { type: Boolean, default: false },
  skipWeekendSaturday: { type: Boolean, default: false },
  skipWeekendSunday: { type: Boolean, default: false },
  skipDates: { type: [String], default: [] },
  daily: { type: ScheduleRepeatDailySchema, default: {} },
  weekly: { type: ScheduleRepeatWeeklySchema, default: {} },
  monthly: { type: ScheduleRepeatMonthlySchema, default: {} },
  last_execution_date: { type: Date }
}, { _id: false });

export interface IScheduleMaster extends Document {
  account_id: ObjectId;
  title: string;
  description: string;
  schedule: ISchedule;
  work_order: WorkOrder;
  cron_lock_acquired_at?: Date | null;
  cron_lock_instance_id?: string | null;
  visible: boolean;
  createdBy: ObjectId;
  updatedBy: ObjectId;
}

const ScheduleMasterSchema = new Schema<IScheduleMaster>(
  {
    account_id: { type: mongoose.Types.ObjectId, ref: "AccountModel", required: true },
    title: { type: String, trim: true, required: true },
    description: { type: String, trim: true },
    schedule: { type: ScheduleSchema, required: true },
    work_order: { type: WorkOrderSchema, required: true },
    cron_lock_acquired_at: { type: Date },
    cron_lock_instance_id: { type: String, trim: true },
    visible: { type: Boolean, default: true },
    createdBy: { type: mongoose.Types.ObjectId, ref: "UserModel", required: true },
    updatedBy: { type: mongoose.Types.ObjectId, ref: "UserModel" }
  },
  {
    collection: "schedule_master",
    timestamps: true,
    versionKey: false
  }
);

ScheduleMasterSchema.index({ account_id: 1, visible: 1 });
ScheduleMasterSchema.index({ account_id: 1, "work_order.wo_location_id": 1 });
ScheduleMasterSchema.index({ "schedule.enabled": 1, visible: 1 });

export const SchedulerModel = mongoose.model<IScheduleMaster>("Schema_Schedule", ScheduleMasterSchema);
