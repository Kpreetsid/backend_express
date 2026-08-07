import { Db } from 'mongodb';

const collectionName = 'asset_report_pdf_jobs';

export const applyAssetReportPdfJobIndexes = async (db: Db): Promise<string[]> => {
  const existing = await db.listCollections({ name: collectionName }).toArray();
  if (existing.length === 0) await db.createCollection(collectionName);
  return db.collection(collectionName).createIndexes([
    {
      key: { accountId: 1, jobId: 1 },
      name: 'accountId_1_jobId_1',
      unique: true
    },
    {
      key: { accountId: 1, reportId: 1, createdAt: -1 },
      name: 'accountId_1_reportId_1_createdAt_-1'
    },
    {
      key: { status: 1, updatedAt: 1 },
      name: 'status_1_updatedAt_1'
    },
    {
      key: { expiresAt: 1 },
      name: 'expiresAt_1',
      expireAfterSeconds: 0
    }
  ]);
};
