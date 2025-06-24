import app from "./app";
import { server as hostDetails } from './configDB';
import { connectDB, disconnectDB } from "./_config/dbConnection";

const server = app.listen(hostDetails.port, async () => {
  await connectDB();
  console.log(`Server running on port http://${hostDetails.host}:${hostDetails.port}`);
});

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