import { Db } from 'mongodb';

const ensureCollection = async (db: Db, name: string): Promise<void> => {
  const existing = await db.listCollections({ name }).toArray();
  if (existing.length === 0) await db.createCollection(name);
};

export const applyUploadQuotaIndexes = async (db: Db): Promise<string[]> => {
  await ensureCollection(db, 'upload_quota_ledgers');
  await ensureCollection(db, 'upload_quota_reservations');

  const ledgerIndexes = await db.collection('upload_quota_ledgers').createIndexes([
    { key: { account_id: 1 }, name: 'account_id_1', unique: true }
  ]);
  const reservationIndexes = await db.collection('upload_quota_reservations').createIndexes([
    { key: { reservationId: 1 }, name: 'reservationId_1', unique: true },
    {
      key: { account_id: 1, status: 1, createdAt: -1 },
      name: 'account_id_1_status_1_createdAt_-1'
    },
    { key: { status: 1, expiresAt: 1 }, name: 'status_1_expiresAt_1' }
  ]);
  return [...ledgerIndexes, ...reservationIndexes];
};
