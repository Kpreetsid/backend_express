import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/_db';
import { applyUploadQuotaIndexes } from '../src/_db/migrations/20260729-upload-quota-indexes';
import { validateConfiguration } from '../src/configDB';

const run = async (): Promise<void> => {
  validateConfiguration();
  await connectDB();
  if (!mongoose.connection.db) throw new Error('MongoDB connection is not ready');
  const names = await applyUploadQuotaIndexes(mongoose.connection.db);
  process.stdout.write(`Upload quota indexes ready: ${names.join(', ')}\n`);
};

run()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
