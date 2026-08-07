import { Db } from 'mongodb';

export const STORED_UPLOAD_COLLECTION = 'stored_upload_metadata';

export const applyStoredUploadMetadataIndexes = async (db: Db): Promise<string[]> => {
  const collections = await db.listCollections({ name: STORED_UPLOAD_COLLECTION }).toArray();
  if (collections.length === 0) {
    await db.createCollection(STORED_UPLOAD_COLLECTION);
  }

  return db.collection(STORED_UPLOAD_COLLECTION).createIndexes([
    {
      key: { storageKey: 1 },
      name: 'storageKey_1',
      unique: true
    },
    {
      key: { account_id: 1, status: 1, createdAt: -1 },
      name: 'account_id_1_status_1_createdAt_-1'
    },
    {
      key: { account_id: 1, checksumSha256: 1 },
      name: 'account_id_1_checksumSha256_1'
    }
  ]);
};
