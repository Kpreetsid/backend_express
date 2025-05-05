import app from "./app";
import { connectDB, disconnectDB } from "./_config/dbConnection";

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, async () => {
  await connectDB();
  console.log(`Server running on port ${PORT}`);
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
