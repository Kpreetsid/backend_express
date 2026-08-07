import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyUploadQuotaIndexes } from './20260729-upload-quota-indexes';

describe('upload quota index migration', () => {
  let mongo: MongoMemoryServer;
  let client: MongoClient;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongo.getUri());
  }, 60_000);

  afterAll(async () => {
    await client.close();
    await mongo.stop();
  });

  it('is repeatable and creates all reviewed quota indexes', async () => {
    const db = client.db('cmms_upload_quota_indexes');
    await applyUploadQuotaIndexes(db);
    await applyUploadQuotaIndexes(db);

    const [ledger, reservations] = await Promise.all([
      db.collection('upload_quota_ledgers').indexes(),
      db.collection('upload_quota_reservations').indexes()
    ]);
    expect(ledger.map((index) => index.name).sort()).toEqual(['_id_', 'account_id_1']);
    expect(ledger.find((index) => index.name === 'account_id_1')?.unique).toBe(true);
    expect(reservations.map((index) => index.name).sort()).toEqual([
      '_id_',
      'account_id_1_status_1_createdAt_-1',
      'reservationId_1',
      'status_1_expiresAt_1'
    ]);
  });
});
