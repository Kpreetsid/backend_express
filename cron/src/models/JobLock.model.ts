import { Schema as _Schema, model as _model, Document as _Document, ObjectId } from "mongoose";

export interface IJobLock extends _Document {
  jobId: ObjectId;
  acquiredAt: Date;
  expiresAt: Date;
  runId: string;
}

const JobLockSchema = new _Schema<IJobLock>({
  jobId: { type: _Schema.Types.ObjectId, ref: "mst_jobs", unique: true, index: true },
  acquiredAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, index: true },
  runId: { type: String, index: true },
}, { timestamps: true });

export const JobLockModel = _model<IJobLock>("mst_job_locks", JobLockSchema);