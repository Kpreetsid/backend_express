import { CronJob } from "cron";

export const startCronJob = async () => {
  const job = new CronJob("*/5 * * * * *", async () => {
    console.log(`[${new Date().toISOString()}] Running order data fetch job...`);
  },
    null,
    false,
    "Asia/Kolkata"
  );
  job.start();
}