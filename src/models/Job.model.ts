// src/models/Job.model.ts
import mongoose, { Document, Schema } from "mongoose";

export interface IJob extends Document {
    _id: string;
    name: string;
    type: "schedule_master" | "cleanup" | "email" | "aggregation" | "custom";
    frequency: "hourly" | "daily" | "weekly" | "monthly" | "custom-cron";
    time?: string; // HH:MM format for daily/weekly/monthly
    customDays?: number[]; // days of week (0-6) or days of month (1-31)
    cronExpression?: string; // for custom-cron frequency
    timezone: string;
    startDate?: Date;
    endDate?: Date;
    isActive: boolean;
    paused: boolean;
    maxRetries: number;
    retryDelayMs: number;
    backoffFactor: number;
    lockTtlMs: number;
    concurrencyKey?: string;
    payload?: any; // job-specific data
    lastRun?: Date;
    nextRunAt?: Date;
    // Schedule Master specific fields
    scheduleMasterId?: string;
    scheduleMode?: string;
    workOrder?: any;
    accountId?: string;
}

const JobSchema = new Schema<IJob>(
    {
        name: { type: String, required: true },
        type: {
            type: String,
            required: true,
            enum: ["schedule_master", "cleanup", "email", "aggregation", "custom"]
        },
        frequency: {
            type: String,
            required: true,
            enum: ["hourly", "daily", "weekly", "monthly", "custom-cron"]
        },
        time: { type: String }, // HH:MM format
        customDays: [{ type: Number }],
        cronExpression: { type: String },
        timezone: { type: String, default: "Asia/Kolkata" },
        startDate: { type: Date },
        endDate: { type: Date },
        isActive: { type: Boolean, default: true },
        paused: { type: Boolean, default: false },
        maxRetries: { type: Number, default: 3 },
        retryDelayMs: { type: Number, default: 5000 },
        backoffFactor: { type: Number, default: 2 },
        lockTtlMs: { type: Number, default: 300000 }, // 5 minutes
        concurrencyKey: { type: String },
        payload: { type: Schema.Types.Mixed },
        lastRun: { type: Date },
        nextRunAt: { type: Date },
        // Schedule Master specific
        scheduleMasterId: { type: String },
        scheduleMode: { type: String },
        workOrder: { type: Schema.Types.Mixed },
        accountId: { type: String }
    },
    {
        timestamps: true,
        collection: 'jobs'
    }
);

// Index for efficient querying
JobSchema.index({ isActive: 1, paused: 1, nextRunAt: 1 });
JobSchema.index({ scheduleMasterId: 1 });

export const JobModel = mongoose.model<IJob>("Job", JobSchema);