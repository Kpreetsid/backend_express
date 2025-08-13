import { CronJob } from "cron";

export const startCronJob = async() => {
  const job = new CronJob("5 * * * * *", async () => {
      console.log(`[${new Date().toISOString()}] Running password auto-update job...`);
    },
    null,
    false, // Start manually
    "Asia/Kolkata"
  );
  job.start();
}