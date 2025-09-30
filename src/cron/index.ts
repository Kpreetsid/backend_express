import cron from "node-cron";
import { processJobsTick } from "./jobRunner";

export async function initJobScheduler() {
  try {
    console.log("🚀 Initializing Advanced Job Scheduler...");
    const TEST_MODE = true;
    if (TEST_MODE) {
      console.log("⚠️ RUNNING IN TEST MODE - Every 2 minutes");
      // Test mode - runs every 2 minutes
      cron.schedule("*/2 * * * *", async () => {
        try {
          console.log("🧪 [TEST] Running job scheduler...");
          await processJobsTick();
        } catch (error) {
          console.error("❌ Error in test schedule:", error);
        }
      }, {
        timezone: "Asia/Kolkata"
      });
      console.log("⏰ Test schedule activated: Every 2 minutes");
    } else {
      // Production mode
      const TARGET_HOUR = 18;
      const TARGET_MINUTE = 40;
      cron.schedule(`${TARGET_MINUTE} ${TARGET_HOUR} * * *`, async () => {
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
    }
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