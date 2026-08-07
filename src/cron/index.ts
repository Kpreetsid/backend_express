import { applicationLogger } from '../observability/logger';
import cron from "node-cron";
import { schedulerService } from "./scheduler.service";
import { snoozeAlarmService } from "./assetAlarmSnooze.service";
import { schedulerRunsCounter } from '../observability/metrics';

export async function initJobScheduler() {
    applicationLogger.info("----> Initializing unified job scheduler...");
    try {
        // Run every day at 00:15 AM
        cron.schedule("15 0 * * *", async () => {
            applicationLogger.info(`${new Date().toISOString()} → Running daily cron jobs...`);
            
            // 🟡 Job 1: Unified Scheduler
            try {
                await schedulerService.runUnifiedScheduler();
                schedulerRunsCounter.inc({ job: 'unified_scheduler', result: 'success' });
            } catch (jobError) {
                schedulerRunsCounter.inc({ job: 'unified_scheduler', result: 'failure' });
                applicationLogger.error({ err: jobError }, "❌ Unified Scheduler job failed:");
            }

            // 🟡 Job 2: Snooze Alarm Service
            try {
                await snoozeAlarmService.runSnoozeAlarm();
                schedulerRunsCounter.inc({ job: 'snooze_alarm', result: 'success' });
            } catch (jobError) {
                schedulerRunsCounter.inc({ job: 'snooze_alarm', result: 'failure' });
                applicationLogger.error({ err: jobError }, "❌ Snooze Alarm job failed:");
            }
        });
        applicationLogger.info("✅ Unified Scheduler initialized (daily at 00:15 AM).");
    } catch (error) {
        applicationLogger.error({ err: error }, "❌ Failed to initialize job scheduler:");
        throw error;
    }
}
