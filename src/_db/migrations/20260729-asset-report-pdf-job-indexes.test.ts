import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyAssetReportPdfJobIndexes } from './20260729-asset-report-pdf-job-indexes';

let server: MongoMemoryServer;
let client: MongoClient;

describe('asset-report PDF job index migration', () => {
  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    client = new MongoClient(server.getUri());
    await client.connect();
  }, 120_000);

  afterAll(async () => {
    await client.close();
    await server.stop();
  });

  it('creates the tenant, operational, and expiration indexes idempotently', async () => {
    const db = client.db('cmms_pdf_job_indexes');
    await applyAssetReportPdfJobIndexes(db);
    await applyAssetReportPdfJobIndexes(db);
    const indexes = await db.collection('asset_report_pdf_jobs').indexes();

    expect(indexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'accountId_1_jobId_1', unique: true }),
      expect.objectContaining({ name: 'accountId_1_reportId_1_createdAt_-1' }),
      expect.objectContaining({ name: 'status_1_updatedAt_1' }),
      expect.objectContaining({ name: 'expiresAt_1', expireAfterSeconds: 0 })
    ]));
  });
});
