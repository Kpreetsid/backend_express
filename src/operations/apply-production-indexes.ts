import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../_db';
import {
  applyStoredUploadMetadataIndexes
} from '../_db/migrations/20260728-stored-upload-metadata-indexes';
import {
  applyUploadQuotaIndexes
} from '../_db/migrations/20260729-upload-quota-indexes';
import {
  applyAssetReportPdfJobIndexes
} from '../_db/migrations/20260729-asset-report-pdf-job-indexes';
import { validateConfiguration } from '../configDB';
import '../app';
import {
  applyDeclaredModelIndexes
} from '../_db/migrations/20260730-declared-model-indexes';

const run = async (): Promise<void> => {
  validateConfiguration();
  await connectDB();

  if (!mongoose.connection.db) {
    throw new Error('MongoDB connection is not ready');
  }

  const storedUploadIndexes = await applyStoredUploadMetadataIndexes(mongoose.connection.db);
  const uploadQuotaIndexes = await applyUploadQuotaIndexes(mongoose.connection.db);
  const assetReportPdfIndexes = await applyAssetReportPdfJobIndexes(mongoose.connection.db);
  const declaredModelIndexes = await applyDeclaredModelIndexes();

  process.stdout.write(
    `Production indexes ready (${declaredModelIndexes.length} models): ${[
      ...storedUploadIndexes,
      ...uploadQuotaIndexes,
      ...assetReportPdfIndexes,
      ...declaredModelIndexes.map(
        (result) => `${result.collection}:${result.indexCount}`
      )
    ].join(', ')}\n`
  );
};

run()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
