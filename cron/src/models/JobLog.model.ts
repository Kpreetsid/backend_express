import { Schema as S, model as M, Document as D, ObjectId } from "mongoose";

export interface IJobLog extends D {
  jobId: ObjectId;
  runId: string;
  status: "started" | "success" | "failed" | "skipped";
  message?: string;
  attempt: number;
  startedAt: Date;
  finishedAt?: Date;
  error?: any;
}

const JobLogSchema = new S<IJobLog>({
  jobId: { type: S.Types.ObjectId, ref: "mst_jobs", index: true },
  runId: { type: String, index: true },
  status: { type: String, enum: ["started", "success", "failed", "skipped"], index: true },
  message: { type: String },
  attempt: { type: Number, default: 1 },
  startedAt: { type: Date, default: Date.now },
  finishedAt: { type: Date },
  error: { type: S.Types.Mixed },
}, { timestamps: true });

export const JobLogModel = M<IJobLog>("mst_job_logs", JobLogSchema);