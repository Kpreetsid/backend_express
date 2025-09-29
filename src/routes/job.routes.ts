// src/routes/jobRoutes.ts
import express from 'express';
import {
    createJob,
    listJobs,
    getJob,
    updateJob,
    deleteJob,
    pauseJob,
    resumeJob,
    toggleActive,
    previewJob,
    runNow,
    runSpecificJob,
    getJobLogs,
    getJobStats,
    syncScheduleMaster
} from '../controllers/job.controller';

const router = express.Router();

// Job CRUD operations
router.post('/', createJob);
router.get('/', listJobs);
router.get('/stats', getJobStats);
router.get('/sync-schedule-master', syncScheduleMaster);
router.post('/preview', previewJob);
router.post('/run-now', runNow);

router.get('/:id', getJob);
router.put('/:id', updateJob);
router.delete('/:id', deleteJob);

// Job control operations
router.post('/:id/pause', pauseJob);
router.post('/:id/resume', resumeJob);
router.post('/:id/toggle-active', toggleActive);
router.post('/:id/run', runSpecificJob);

// Logs
router.get('/:id/logs', getJobLogs);
router.get('/logs/all', (req: any, res) => {
    // Modify the existing req.params instead of creating new object
    req.params.id = '';
    getJobLogs(req, res);
});

export default router;