import cron from "node-cron";
import { schedulerService } from "./scheduler.service";
import { snoozeAlarmService } from "./assetAlarmSnooze.service";
import { resolveSchedulerTimeZone } from './scheduleCadence';
import { postPublishingService } from './postPublishing.service';

export async function initJobScheduler() {
    console.log("----> Initializing unified job scheduler...");
    try {
        const timeZone = resolveSchedulerTimeZone();
        // Run every day at 00:15 AM
        cron.schedule("15 0 * * *", async () => {
            console.log(`${new Date().toISOString()} → Running daily cron jobs...`);
            
            // 🟡 Job 1: Unified Scheduler
            try {
                await schedulerService.runUnifiedScheduler();
            } catch (jobError) {
                console.error("❌ Unified Scheduler job failed:", jobError);
            }

            // 🟡 Job 2: Snooze Alarm Service
            try {
                await snoozeAlarmService.runSnoozeAlarm();
            } catch (jobError) {
                console.error("❌ Snooze Alarm job failed:", jobError);
            }
        }, { timezone: timeZone });
        cron.schedule("* * * * *", async () => {
            try {
                await postPublishingService.publishDuePosts();
            } catch (jobError) {
                console.error("❌ Scheduled post publishing failed:", jobError);
            }
        }, { timezone: timeZone });
        console.log(`✅ Unified Scheduler initialized (daily at 00:15 AM, ${timeZone}).`);
    } catch (error) {
        console.error("❌ Failed to initialize job scheduler:", error);
        throw error;
    }
}
