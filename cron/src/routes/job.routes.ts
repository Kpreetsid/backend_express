import { Router } from "express";
import { createJob, listJobs, getJob, updateJob, deleteJob, pauseJob, resumeJob, toggleActive, previewJob, runNow } from "../controllers/job.controller";

export const jobRouter = Router();

jobRouter.post("/jobs", createJob);
jobRouter.get("/jobs", listJobs);
jobRouter.get("/jobs/:id", getJob);
jobRouter.put("/jobs/:id", updateJob);
jobRouter.delete("/jobs/:id", deleteJob);
jobRouter.post("/jobs/:id/pause", pauseJob);
jobRouter.post("/jobs/:id/resume", resumeJob);
jobRouter.post("/jobs/:id/toggle", toggleActive);
jobRouter.post("/jobs/preview", previewJob); // body = job draft
jobRouter.post("/jobs/run-now", runNow);