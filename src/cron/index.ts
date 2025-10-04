import cron from "node-cron";
import { schedulerService } from "./scheduler.service";

export async function initJobScheduler() {
    console.log("---->  Initializing job scheduler...");
    try {
        // Daily @ midnight
        cron.schedule("45 0 * * *", async () => {
            console.log(`${new Date().toISOString()} Running daily job tick...`);
            await schedulerService.runDailyScheduler();
        });

        // Weekly @ midnight
        cron.schedule("45 0 * * 0", async () => {
            console.log(`${new Date().toISOString()} Running weekly job tick...`);
            await schedulerService.runWeeklyScheduler();
        });

        // Monthly @ midnight on 1st
        cron.schedule("0 0 1 * *", async () => {
            console.log(`${new Date().toISOString()} Running monthly job tick...`);
            await schedulerService.runMonthlyScheduler();
        });
    } catch (error) {
        console.error("Failed to initialize job scheduler:", error);
        throw error;
    }
}