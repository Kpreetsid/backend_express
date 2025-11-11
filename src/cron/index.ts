import cron from "node-cron";
import { schedulerService } from "./scheduler.service";

export async function initJobScheduler() {
    console.log("----> Initializing unified job scheduler...");
    try {
        // Run every day at 00:15 AM
        cron.schedule("15 0 * * *", async () => {
            console.log(`${new Date().toISOString()} → Running unified scheduler tick...`);
            await schedulerService.runUnifiedScheduler();
        });
        console.log("✅ Unified Scheduler initialized (daily at 00:15 AM).");
    } catch (error) {
        console.error("❌ Failed to initialize job scheduler:", error);
        throw error;
    }
}