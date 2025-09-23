import { CronJob } from "cron";
import { scheduledWorkOrder } from "./scheduler.service";

export const startCronJob = async () => {
  console.log("Cron job started");
  const job = new CronJob("*/5 * * * * *", async () => {
    await scheduledWorkOrder();
  });
  job.start();
}