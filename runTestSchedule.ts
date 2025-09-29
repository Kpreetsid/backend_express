import mongoose from "mongoose";
import { testScheduleExecution, triggerScheduleManually } from "./src/cron/jobRunner";

async function runTest() {
    try {
        // 1. Connect to MongoDB if not already connected
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI || "", {
                autoIndex: true
            });
            console.log("MongoDB connected for testing...");
        }

        // 2. Option A: Execute by title (simpler)
        await testScheduleExecution();

        // 2. Option B: Execute by ID
        // const scheduleId = "68d1280896f30069ee7a2cdb"; // replace with your _id
        // await triggerScheduleManually(scheduleId);

        console.log("✅ Test schedule execution finished.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Test execution failed:", err);
        process.exit(1);
    }
}

runTest();
