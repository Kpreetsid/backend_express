import cron from "node-cron";
import { processJobsTick } from "./jobRunner";

export async function initJobScheduler() {
  try {
    console.log("---->  Initializing job scheduler...");
    cron.schedule(`*/2 * * * *`, async () => {
      console.log(`${new Date().toISOString()} Running job tick...`);
      await processJobsTick();
    }, {
      timezone: "Asia/Kolkata"
    });
    cron.schedule("0 5 * * *", async () => {
      console.log(`${new Date().toISOString()} Running job tick...`);
      await processJobsTick();
    }, {
      timezone: "Asia/Kolkata"
    });
  } catch (error) {
    console.error("Failed to initialize job scheduler:", error);
    throw error;
  }
}