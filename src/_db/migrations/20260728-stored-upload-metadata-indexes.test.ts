import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  STORED_UPLOAD_COLLECTION,
  applyStoredUploadMetadataIndexes
} from './20260728-stored-upload-metadata-indexes';

describe('stored upload metadata index migration', () => {
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

  it('is repeatable and creates the reviewed tenant/query indexes', async () => {
    const db = client.db('cmms_index_migration_test');
    await applyStoredUploadMetadataIndexes(db);
    await applyStoredUploadMetadataIndexes(db);

    const indexes = await db.collection(STORED_UPLOAD_COLLECTION).indexes();
    expect(indexes.map((index) => index.name).sort()).toEqual([
      '_id_',
      'account_id_1_checksumSha256_1',
      'account_id_1_status_1_createdAt_-1',
      'storageKey_1'
    ]);
    expect(indexes.find((index) => index.name === 'storageKey_1')?.unique).toBe(true);
  });
});
