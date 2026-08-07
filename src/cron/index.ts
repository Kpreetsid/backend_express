import cron from "node-cron";
import { schedulerService } from "./scheduler.service";
import { snoozeAlarmService } from "./assetAlarmSnooze.service";

export async function initJobScheduler() {
    console.log("----> Initializing unified job scheduler...");
    try {
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
        });
        console.log("✅ Unified Scheduler initialized (daily at 00:15 AM).");
    } catch (error) {
        console.error("❌ Failed to initialize job scheduler:", error);
        throw error;
    }
}