import cron from "node-cron";
import { processJobsTick } from "./jobRunner";

export function initJobScheduler() {
  console.log("✅ Advanced Job Scheduler started");

  // Every minute: tick the scheduler (fine-grained control)
  cron.schedule("* * * * *", () => processJobsTick().catch(console.error));

  // Additionally, your requested schedules:
  // Every 6 hours at minute 0
  // cron.schedule("0 */6 * * *", () => processJobsTick().catch(console.error));
  cron.schedule("*/5 * * * * *", () => processJobsTick().catch(console.error));
  // Every day at 5:00 AM
  cron.schedule("0 5 * * *", () => processJobsTick().catch(console.error));
}