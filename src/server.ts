// import app from "./app";
// import { server as hostDetails } from './configDB';
// import { connectDB, disconnectDB } from "./_config/dbConnection";
// import { initJobScheduler } from "./cron";
// import workOrderRoutes from "./routes/workOrderRoutes";
// import { startScheduler } from "./cron/jobRunner";
// // import { startCronJob } from "./cron";

// app.use("/work-orders", workOrderRoutes);

// const server = app.listen(hostDetails.port, async () => {
//   await connectDB();
//   // await startCronJob();
//   await initJobScheduler();
//   console.log(`Server running on port http://${hostDetails.host}:${hostDetails.port}`);
// });

// const shutdown = async () => {
//   console.log("\nGracefully shutting down...");
//   await disconnectDB();
//   server.close(() => {
//     console.log("Server closed");
//     process.exit(0);
//   });
// };

// process.on("SIGINT", shutdown);
// process.on("SIGTERM", shutdown);

// src/server.ts

// 1️⃣ Load all models first (important for Mongoose populate)
import './models/user.model';
import './models/workOrder.model';
import './models/scheduleMaster.model';
import './models/mapUserWorkOrder.model';
// import other models here as needed

// 2️⃣ Import the rest of your modules
import app from "./app";
import { server as hostDetails } from './configDB';
import { connectDB, disconnectDB } from "./_config/dbConnection";
import { initJobScheduler } from "./cron";

// 3️⃣ Start server and DB connection
const server = app.listen(hostDetails.port, async () => {
  await connectDB();

  // Initialize schedulers
  await initJobScheduler();

  console.log(`🚀 Server running on port http://${hostDetails.host}:${hostDetails.port}`);


});

// 4️⃣ Graceful shutdown
const shutdown = async () => {
  console.log("\nGracefully shutting down...");
  await disconnectDB();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
