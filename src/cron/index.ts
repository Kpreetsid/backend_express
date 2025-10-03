import cron from "node-cron";
import { processJobsTick } from "./jobRunner";

export async function initJobScheduler() {
  try {
    console.log("🚀 Initializing Advanced Job Scheduler...");
    // Production mode
    cron.schedule(`*/2 * * * *`, async () => {
      try {
        console.log("🕘 Running daily work order schedule at 18:40 IST");
        await processJobsTick();
      } catch (error) {
        console.error("❌ Error in daily work order schedule:", error);
      }
    }, {
      timezone: "Asia/Kolkata"
    });
    console.log("⏰ Production schedule activated: Daily at 18:40 IST");
    // Health check at 5:00 AM (always active)
    cron.schedule("0 5 * * *", async () => {
      try {
        console.log("🏥 Running daily health check...");
        await processJobsTick();
        console.log("✅ Daily health check completed");
      } catch (error) {
        console.error("❌ Error in daily health check:", error);
      }
    }, {
      timezone: "Asia/Kolkata"
    });
    console.log("✅ Advanced Job Scheduler initialized");
  } catch (error) {
    console.error("❌ Failed to initialize job scheduler:", error);
    throw error;
  }
}