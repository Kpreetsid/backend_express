import { v4 as uuid } from "uuid";
import { JobModel, IJob } from "../models/Job.model";
import { JobLockModel } from "../models/JobLock.model";
import { JobLogModel } from "../models/JobLog.model";
import { matchesNow, inRange, computeNextRuns } from "./schedule.utils";

async function acquireLock(job: IJob): Promise<string | null> {
  const runId = uuid();
  const now = new Date();
  const expires = new Date(now.getTime() + job.lockTtlMs);
  try {
    const res = await JobLockModel.findOneAndUpdate(
      { jobId: job._id, $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }] },
      { jobId: job._id, acquiredAt: now, expiresAt: expires, runId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    // If lock exists but not ours and not expired, reject
    if (res && res.runId !== runId && res.expiresAt > now) return null;
    return runId;
  } catch {
    return null;
  }
}

async function releaseLock(jobId: string, runId: string) {
  await JobLockModel.deleteOne({ jobId, runId }).catch(() => { });
}

async function logStatus(jobId: string, runId: string, status: "started" | "success" | "failed" | "skipped", attempt: number, message?: string, error?: any) {
  const doc = new JobLogModel({ jobId, runId, status, attempt, message, error, startedAt: new Date(), finishedAt: status !== "started" ? new Date() : undefined });
  await doc.save().catch(() => { });
}

async function executeOperation(job: IJob, runId: string, attempt: number): Promise<void> {
  // TODO: replace with your real operations based on job.type
  switch (job.type) {
    case "cleanup":
      // e.g., delete soft-deleted docs older than X days using job.payload
      console.log(`[CLEANUP] runId=${runId} payload=`, job.payload);
      break;
    case "email":
      console.log(`[EMAIL] runId=${runId} to=${job.payload?.to}`);
      break;
    case "aggregation":
      console.log(`[AGG] runId=${runId} params=`, job.payload);
      break;
    default:
      console.log(`[GENERIC] runId=${runId} job=${job.name}`);
  }
}




async function runWithRetry(job: IJob, runId: string) {
  let attempt = 1;
  let delay = job.retryDelayMs;
  await logStatus(`${job._id}`, runId, "started", attempt, `Job ${job.name} started`);
  while (attempt <= job.maxRetries) {
    try {
      await executeOperation(job, runId, attempt);
      await JobModel.findByIdAndUpdate(job._id, { $set: { lastRun: new Date() } });
      await logStatus(`${job._id}`, runId, "success", attempt, `Job ${job.name} succeeded`);
      return;
    } catch (err) {
      await logStatus(`${job._id}`, runId, "failed", attempt, `Attempt ${attempt} failed`, err);
      if (attempt >= job.maxRetries) throw err;
      await new Promise(res => setTimeout(res, delay));
      delay = Math.floor(delay * (job.backoffFactor || 1));
      attempt++;
    }
  }
}

export async function processJobsTick(now = new Date()) {
  // Fetch a manageable batch (UI can page through all)
  const jobs = await JobModel.find({ isActive: true, paused: { $ne: true } }).limit(200);
  console.log(`🕒 Job Tick at ${now.toISOString()}, evaluating ${jobs.length} jobs`);
  for (const job of jobs) {
    if (!inRange(job, now)) continue;
    if (!matchesNow(job, now)) continue;

    // Concurrency control
    if (job.concurrencyKey) {
      const lock = await JobLockModel.findOne({ jobId: job._id });
      if (lock && lock.expiresAt > new Date()) continue; // already running somewhere
    }

    const runId = await acquireLock(job);
    if (!runId) { continue; }

    try {
      await runWithRetry(job, runId);
    } finally {
      await releaseLock(`${job._id}`, runId);
    }
  }
}

export async function updateNextRun(job: IJob) {
  const nexts = computeNextRuns(job, 1);
  await JobModel.findByIdAndUpdate(job._id, { $set: { nextRunAt: nexts[0] || null } });
}
