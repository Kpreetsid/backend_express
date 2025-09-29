// src/models/JobLock.model.ts
import mongoose, { Document, Schema } from "mongoose";

export interface IJobLock extends Document {
    jobId: string;
    runId: string;
    acquiredAt: Date;
    expiresAt: Date;
}

const JobLockSchema = new Schema<IJobLock>(
    {
        jobId: { type: String, required: true, unique: true },
        runId: { type: String, required: true },
        acquiredAt: { type: Date, required: true },
        expiresAt: { type: Date, required: true }
    },
    {
        collection: 'job_locks'
    }
);

// TTL index to automatically remove expired locks
JobLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const JobLockModel = mongoose.model<IJobLock>("JobLock", JobLockSchema);