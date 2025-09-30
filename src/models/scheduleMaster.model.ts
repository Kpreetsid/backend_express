import mongoose, { Document, ObjectId, Schema } from "mongoose";

interface TaskOption {
  key: string;
  value: string | number | boolean;
}

interface Task {
  title: string;
  type: "text" | "number" | "multipleChoice" | "checkBox"; // enum
  fieldValue: string;
  options: TaskOption[];
}

const TaskSchema = new Schema<Task>({
  title: { type: String, required: true },
  type: { type: String, required: true },
  fieldValue: { type: String },
  options: [{ key: String, value: String }],
}, { _id: false });

interface IPart {
  part_id: string;
  part_name: string;
  part_type: string;
  estimatedQuantity: number;
}

const PartSchema = new Schema<IPart>({
  part_id: { type: String, required: true },
  part_name: { type: String, required: true },
  part_type: { type: String, required: true },
  estimatedQuantity: { type: Number, required: true },
}, { _id: false });

interface WorkOrder {
  title: string;
  description: string;
  type: "Preventive" | "Corrective" | "Predictive"; // enum
  status: "Open" | "In Progress" | "Completed" | "Closed"; // enum
  priority: "Low" | "Medium" | "High" | "Critical"; // enum
  estimated_time: string;
  start_date: string;
  end_date: string;
  wo_location_id: ObjectId;
  wo_asset_id: ObjectId;
  sop_form_id: ObjectId;
  userIdList: string[];
  tasks: Task[];
  parts: IPart[];
  workInstruction: string;
  createdFrom?: string;
}

const WorkOrderSchema = new Schema<WorkOrder>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, required: true },
  status: { type: String, required: true },
  priority: { type: String, required: true },
  estimated_time: { type: String },
  start_date: { type: String, required: true },
  end_date: { type: String },
  wo_location_id: { type: Schema.Types.ObjectId, required: true },
  wo_asset_id: { type: Schema.Types.ObjectId, required: true },
  sop_form_id: { type: Schema.Types.ObjectId },
  userIdList: { type: [String], required: true },
  tasks: { type: [TaskSchema] },
  parts: { type: [PartSchema] },
  workInstruction: { type: String },
  createdFrom: { type: String },
}, { _id: false });

interface ScheduleRepeatWeekly {
  interval: number | null;
  days: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
}

interface ScheduleRepeatMonthly {
  interval: number | null;
  dayOfMonth: number | null;
}

interface Schedule {
  mode: "daily" | "weekly" | "monthly"; // enum
  enabled: boolean;
  days_to_complete: number;
  no_of_time_call: number;
  start_date: string;
  end_date?: string | null;
  repeat: {
    weekly: ScheduleRepeatWeekly;
    monthly: ScheduleRepeatMonthly;
  };
}

const ScheduleSchema = new Schema<Schedule>({
  mode: { type: String, enum: ["none", "daily", "weekly", "monthly"], required: true },
  enabled: { type: Boolean, default: true },
  days_to_complete: { type: Number, required: true },
  no_of_time_call: { type: Number, default: 1 },
  start_date: { type: String, required: true },
  end_date: { type: String },
  repeat: {
    weekly: {
      interval: { type: Number, default: 1 },
      days: {
        monday: { type: Boolean, default: false },
        tuesday: { type: Boolean, default: false },
        wednesday: { type: Boolean, default: false },
        thursday: { type: Boolean, default: false },
        friday: { type: Boolean, default: false },
        saturday: { type: Boolean, default: false },
        sunday: { type: Boolean, default: false },
      },
    },
    monthly: {
      interval: { type: Number, default: 1 },
      dayOfMonth: { type: Number, default: 1 },
    },
  },
}, { _id: false });

export interface IScheduleMaster extends Document {
  account_id: ObjectId;
  title: string;
  description: string;
  schedule: Schedule;
  work_order: WorkOrder;
  last_execution_date: Date;
  next_execute_date: Date;
  visible: boolean;
  createdBy: ObjectId;
  updatedBy: ObjectId;
}

const ScheduleMasterSchema = new Schema<IScheduleMaster>(
  {
    account_id: { type: mongoose.Types.ObjectId, ref: "AccountModel", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    schedule: { type: ScheduleSchema, required: true },
    work_order: { type: WorkOrderSchema, required: true },
    visible: { type: Boolean, required: true, default: true },
    last_execution_date: { type: Date },
    next_execute_date: { type: Date },
    createdBy: { type: mongoose.Types.ObjectId, ref: "UserModel", required: true },
    updatedBy: { type: mongoose.Types.ObjectId, ref: "UserModel" },
  },
  {
    collection: "schedule_master",
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      }
    }
  }
);

export const SchedulerModel = mongoose.model<IScheduleMaster>("Schema_Schedule", ScheduleMasterSchema);
