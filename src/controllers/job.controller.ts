// src/controllers/jobController.ts
import { Request, Response } from "express";
import { JobModel } from "../models/Job.model";
import { JobLogModel } from "../models/JobLog.model";
import { JobLockModel } from "../models/JobLock.model";
import { computeNextRuns } from "../cron/schedule.utils";
import { processJobsTick, updateNextRun } from "../cron/jobRunner";
import { convertScheduleMasterToJobs } from "../cron/scheduleConverter";

export const createJob = async (req: Request, res: Response): Promise<void> => {
    try {
        const job = await JobModel.create(req.body);
        await updateNextRun(job);
        res.status(201).json(job);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
};

export const listJobs = async (req: Request, res: Response): Promise<void> => {

    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const filter: any = {};
        if (req.query.type) filter.type = req.query.type;
        if (req.query.frequency) filter.frequency = req.query.frequency;
        if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';
        if (req.query.paused !== undefined) filter.paused = req.query.paused === 'true';

        const jobs = await JobModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await JobModel.countDocuments(filter);

        res.json({
            jobs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const getJob = async (req: Request, res: Response): Promise<void> => {
    try {
        const job = await JobModel.findById(req.params.id);
        if (!job) {
            res.status(404).json({ error: "Job not found" });
            return;
        }

        // Also get recent logs for this job
        const logs = await JobLogModel.find({ jobId: req.params.id })
            .sort({ startedAt: -1 })
            .limit(10);

        res.json({ job, logs });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const updateJob = async (req: Request, res: Response): Promise<void> => {
    try {
        const job = await JobModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!job) {
            res.status(404).json({ error: "Job not found" });
            return;
        }
        await updateNextRun(job);
        res.json(job);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
};

export const deleteJob = async (req: Request, res: Response): Promise<void> => {
    try {
        const job = await JobModel.findByIdAndDelete(req.params.id);
        if (!job) {
            res.status(404).json({ error: "Job not found" });
            return;
        }

        // Clean up related data
        await JobLockModel.deleteMany({ jobId: req.params.id });
        await JobLogModel.deleteMany({ jobId: req.params.id });

        res.json({ ok: true, message: "Job deleted successfully" });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const pauseJob = async (req: Request, res: Response): Promise<void> => {
    try {
        const job = await JobModel.findByIdAndUpdate(
            req.params.id,
            { $set: { paused: true } },
            { new: true }
        );
        if (!job) {
            res.status(404).json({ error: "Job not found" });
            return;
        }
        res.json(job);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const resumeJob = async (req: Request, res: Response): Promise<void> => {
    try {
        const job = await JobModel.findByIdAndUpdate(
            req.params.id,
            { $set: { paused: false } },
            { new: true }
        );
        if (!job) {
            res.status(404).json({ error: "Job not found" });
            return;
        }
        await updateNextRun(job);
        res.json(job);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const toggleActive = async (req: Request, res: Response): Promise<void> => {
    try {
        const job = await JobModel.findById(req.params.id);
        if (!job) {
            res.status(404).json({ error: "Job not found" });
            return;
        }

        job.isActive = !job.isActive;
        await job.save();
        await updateNextRun(job);
        res.json(job);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const previewJob = async (req: Request, res: Response): Promise<void> => {
    try {
        const jobLike = req.body;
        const count = Number(req.query.count) || 10;
        const runs = computeNextRuns(jobLike, count);
        res.json({ next: runs });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
};

export const runNow = async (req: Request, res: Response): Promise<void> => {
    try {
        await processJobsTick();
        res.json({ ok: true, message: "Job tick executed successfully" });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const runSpecificJob = async (req: Request, res: Response): Promise<void> => {
    try {
        const job = await JobModel.findById(req.params.id);
        if (!job) {
            res.status(404).json({ error: "Job not found" });
            return;
        }

        // Temporarily enable the job for immediate execution
        const wasActive = job.isActive;
        const wasPaused = job.paused;

        job.isActive = true;
        job.paused = false;
        await job.save();

        // Run the specific job
        await processJobsTick();

        // Restore original state
        job.isActive = wasActive;
        job.paused = wasPaused;
        await job.save();

        res.json({ ok: true, message: `Job ${job.name} executed successfully` });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const getJobLogs = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;

        const filter: any = {};
        if (req.params.id && req.params.id !== '') {
            filter.jobId = req.params.id;
        }
        if (req.query.status) filter.status = req.query.status;

        const logs = await JobLogModel.find(filter)
            .sort({ startedAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await JobLogModel.countDocuments(filter);

        res.json({
            logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const getJobStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const stats = await Promise.all([
            JobModel.countDocuments({ isActive: true, paused: false }),
            JobModel.countDocuments({ isActive: true, paused: true }),
            JobModel.countDocuments({ isActive: false }),
            JobLogModel.countDocuments({ status: "success", startedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
            JobLogModel.countDocuments({ status: "failed", startedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
            JobLockModel.countDocuments({ expiresAt: { $gt: new Date() } })
        ]);

        const [activeJobs, pausedJobs, inactiveJobs, successfulRuns, failedRuns, runningJobs] = stats;

        res.json({
            jobs: {
                active: activeJobs,
                paused: pausedJobs,
                inactive: inactiveJobs,
                total: activeJobs + pausedJobs + inactiveJobs
            },
            runs: {
                successful: successfulRuns,
                failed: failedRuns,
                running: runningJobs
            }
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const syncScheduleMaster = async (req: Request, res: Response): Promise<void> => {
    try {
        await convertScheduleMasterToJobs();
        res.json({ ok: true, message: "Schedule Master entries synchronized successfully" });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

