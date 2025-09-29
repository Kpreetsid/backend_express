import { Request, Response } from "express";
import { JobModel } from "../models/Job.model";
import { computeNextRuns } from "../cron/schedule.utils";
import { processJobsTick, updateNextRun } from "../cron/jobRunner";

export const createJob = async (req: Request, res: Response) => {
  try {
    const job = await JobModel.create(req.body);
    await updateNextRun(job);
    res.status(201).json(job);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

export const listJobs = async (_: Request, res: Response) => {
  const jobs = await JobModel.find({}).sort({ createdAt: -1 });
  res.json(jobs);
};

export const getJob = async (req: Request, res: Response) => {
  const job = await JobModel.findById(req.params.id);
  if (!job) return res.status(404).json({ error: "Not found" });
  res.json(job);
};

export const updateJob = async (req: Request, res: Response) => {
  const job = await JobModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!job) return res.status(404).json({ error: "Not found" });
  await updateNextRun(job);
  res.json(job);
};

export const deleteJob = async (req: Request, res: Response) => {
  await JobModel.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
};

export const pauseJob = async (req: Request, res: Response) => {
  const job = await JobModel.findByIdAndUpdate(req.params.id, { $set: { paused: true } }, { new: true });
  if (!job) return res.status(404).json({ error: "Not found" });
  res.json(job);
};

export const resumeJob = async (req: Request, res: Response) => {
  const job = await JobModel.findByIdAndUpdate(req.params.id, { $set: { paused: false } }, { new: true });
  if (!job) return res.status(404).json({ error: "Not found" });
  await updateNextRun(job);
  res.json(job);
};

export const toggleActive = async (req: Request, res: Response) => {
  const job = await JobModel.findById(req.params.id);
  if (!job) return res.status(404).json({ error: "Not found" });
  job.isActive = !job.isActive;
  await job.save();
  await updateNextRun(job);
  res.json(job);
};

export const previewJob = async (req: Request, res: Response) => {
  try {
    const jobLike = req.body; // not persisted; just compute
    const runs = computeNextRuns(jobLike, Number(req.query.count) || 10);
    res.json({ next: runs });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

export const runNow = async (_req: Request, res: Response) => {
  await processJobsTick(); // triggers immediate evaluation
  res.json({ ok: true, message: "Tick executed" });
};
