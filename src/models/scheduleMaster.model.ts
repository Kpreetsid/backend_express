import mongoose, { Document, ObjectId, Schema } from "mongoose";

interface TaskOption {
  key: string;
  value: string | number | boolean;
}

interface Task {
  title: string;
  type: "text" | "number" | "multipleChoice" | "checkBox";
  fieldValue: string;
  options: TaskOption[];
}

const TaskSchema = new Schema<Task>({
  title: { type: String, trim: true, required: true },
  type: { type: String, trim: true, required: true },
  fieldValue: { type: String, trim: true },
  options: [{ key: String, value: Schema.Types.Mixed }]
}, { _id: false });

interface IPart {
  part_id: string;
  part_name: string;
  part_type: string;
  estimatedQuantity: number;
  unit: string;
}

const PartSchema = new Schema<IPart>({
  part_id: { type: String, required: true },
  part_name: { type: String, trim: true, required: true },
  part_type: { type: String, trim: true, required: true },
  estimatedQuantity: { type: Number, required: true },
  unit: { type: String, trim: true }
}, { _id: false });

interface WorkOrder {
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  estimated_time: number;
  start_date: string;
  end_date: string | null;
  wo_location_id: ObjectId;
  wo_asset_id: ObjectId;
  sop_form_id?: ObjectId;
  userIdList: string[];
  tasks: Task[];
  parts: IPart[];
  workInstruction: any[];
  createdFrom?: string;
}

const WorkOrderSchema = new Schema<WorkOrder>({
  title: { type: String, trim: true, required: true },
  description: { type: String, trim: true },
  type: { type: String, trim: true, required: true },
  status: { type: String, trim: true, required: true },
  priority: { type: String, trim: true, required: true },
  estimated_time: Number,
  start_date: { type: String, required: true },
  end_date: { type: String },
  wo_location_id: { type: Schema.Types.ObjectId, ref: "LocationModel", required: true },
  wo_asset_id: { type: Schema.Types.ObjectId, ref: "AssetModel", required: true },
  sop_form_id: { type: Schema.Types.ObjectId, ref: "SopFormModel" },
  userIdList: { type: [String], required: true },
  tasks: { type: [TaskSchema], default: [] },
  parts: { type: [PartSchema], default: [] },
  workInstruction: { type: Schema.Types.Mixed, default: [] },
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
    visible: { type: Boolean, default: true },
    createdBy: { type: mongoose.Types.ObjectId, ref: "UserModel", required: true },
    updatedBy: { type: mongoose.Types.ObjectId, ref: "UserModel" }
  },
  {
    collection: "schedule_master",
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      }
    }
  }
);

export const SchedulerModel = mongoose.model<IScheduleMaster>("Schema_Schedule", ScheduleMasterSchema);