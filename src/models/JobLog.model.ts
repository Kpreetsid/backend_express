// src/models/JobLog.model.ts
import mongoose, { Document, Schema } from "mongoose";

export interface IJobLog extends Document {
    jobId: string;
    runId: string;
    status: "started" | "success" | "failed" | "skipped";
    attempt: number;
    message?: string;
    error?: any;
    startedAt: Date;
    finishedAt?: Date;
}

const JobLogSchema = new Schema<IJobLog>(
    {
        jobId: { type: String, required: true },
        runId: { type: String, required: true },
        status: {
            type: String,
            required: true,
            enum: ["started", "success", "failed", "skipped"]
        },
        attempt: { type: Number, required: true },
        message: { type: String },
        error: { type: Schema.Types.Mixed },
        startedAt: { type: Date, required: true },
        finishedAt: { type: Date }
    },
    {
        collection: 'job_logs'
    }
);

// Index for querying logs by job and time
JobLogSchema.index({ jobId: 1, startedAt: -1 });
JobLogSchema.index({ startedAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL

export const JobLogModel = mongoose.model<IJobLog>("JobLog", JobLogSchema);