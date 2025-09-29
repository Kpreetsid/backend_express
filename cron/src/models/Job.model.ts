import { Schema, model, Document } from "mongoose";

export type JobFrequency = "hourly" | "daily" | "weekly" | "monthly" | "custom-cron";

export interface IJob extends Document {
  name: string;
  description?: string;
  // Core scheduling
  frequency: JobFrequency;
  time?: string; // HH:mm for daily/weekly/monthly
  customDays?: number[]; // weekly: 0-6 (Sun-Sat); monthly: 1-31
  cronExpression?: string; // for custom-cron
  timezone?: string; // e.g. "Asia/Kolkata"
  // Activation window
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  // Execution control
  maxRetries: number; // total attempts per scheduled run
  retryDelayMs: number; // base delay between retries (with backoff)
  backoffFactor: number; // multiplier for retries
  lockTtlMs: number; // how long a worker can hold a lock
  concurrencyKey?: string; // prevent parallel runs of same key
  // Data/operation
  type: string; // e.g., "cleanup", "email", "aggregation" (decide in runner)
  payload?: Record<string, any>;
  // Tracking
  lastRun?: Date;
  nextRunAt?: Date; // precomputed next time (used by preview & UI)
  paused: boolean;
}

const JobSchema = new Schema<IJob>({
  name: { type: String, required: true, index: true },
  description: { type: String },
  frequency: { type: String, enum: ["hourly", "daily", "weekly", "monthly", "custom-cron"], required: true },
  time: { type: String },
  customDays: [{ type: Number }],
  cronExpression: { type: String },
  timezone: { type: String, default: "Asia/Kolkata" },
  startDate: { type: Date },
  endDate: { type: Date },
  isActive: { type: Boolean, default: true, index: true },
  maxRetries: { type: Number, default: 3 },
  retryDelayMs: { type: Number, default: 60_000 },
  backoffFactor: { type: Number, default: 2 },
  lockTtlMs: { type: Number, default: 15 * 60_000 },
  concurrencyKey: { type: String, index: true },
  type: { type: String, required: true },
  payload: { type: Schema.Types.Mixed },
  lastRun: { type: Date },
  nextRunAt: { type: Date, index: true },
  paused: { type: Boolean, default: false },
}, { timestamps: true });

export const JobModel = model<IJob>("mst_jobs", JobSchema);