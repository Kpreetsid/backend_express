import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { initJobScheduler } from "./cron";
import { jobRouter } from "./routes/job.routes";

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api", jobRouter);

mongoose.connect(`mongodb://PresageTesting:Presage%40TestPswd%402025@15.207.122.61:27017/cron_demo?authSource=admin`)
  .then(() => {
    console.log("MongoDB connected");
    initJobScheduler();
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
  })
  .catch(err => console.error(err));
