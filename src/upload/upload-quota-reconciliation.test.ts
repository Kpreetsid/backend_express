import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StoredUploadMetadataModel } from '../models/storedUploadMetadata.model';
import { UploadQuotaLedgerModel } from '../models/uploadQuotaLedger.model';
import { UploadQuotaReservationModel } from '../models/uploadQuotaReservation.model';
import { reconcileUploadQuotaUsage } from './upload-quota-reconciliation';

describe('upload quota reconciliation', () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('reports drift by default and repairs ledgers only in execute mode', async () => {
    const accountId = new Types.ObjectId();
    const now = new Date('2026-07-29T00:00:00.000Z');
    await StoredUploadMetadataModel.create([
      {
        account_id: accountId,
        originalName: 'active.png',
        fileName: 'active.png',
        folderName: 'assets',
        storageKey: 'assets/active.png',
        mimeType: 'image/png',
        size: 10,
        checksumSha256: 'a'.repeat(64),
        storageDriver: 's3',
        scanStatus: 'clean',
        status: 'active'
      },
      {
        account_id: accountId,
        originalName: 'deleted.png',
        fileName: 'deleted.png',
        folderName: 'assets',
        storageKey: 'assets/deleted.png',
        mimeType: 'image/png',
        size: 20,
        checksumSha256: 'b'.repeat(64),
        storageDriver: 's3',
        scanStatus: 'clean',
        status: 'deleted'
      }
    ]);
    await UploadQuotaLedgerModel.create({
      account_id: accountId,
      activeBytes: 99,
      reservedBytes: 5
    });
    await UploadQuotaReservationModel.create([
      {
        reservationId: 'future',
        account_id: accountId,
        bytes: 4,
        status: 'pending',
        expiresAt: new Date('2026-07-29T01:00:00.000Z')
      },
      {
        reservationId: 'expired',
        account_id: accountId,
        bytes: 3,
        status: 'pending',
        expiresAt: new Date('2026-07-28T23:00:00.000Z')
      }
    ]);

    const dryRun = await reconcileUploadQuotaUsage(false, now);
    expect(dryRun.mode).toBe('dry-run');
    expect(dryRun.expiredReservations).toBe(1);
    expect(dryRun.entries[0]).toMatchObject({
      currentActiveBytes: 99,
      currentReservedBytes: 5,
      expectedActiveBytes: 10,
      expectedReservedBytes: 4,
      driftBytes: 90
    });
    await expect(UploadQuotaReservationModel.findOne({
      reservationId: 'expired'
    }).then((record) => record?.status)).resolves.toBe('pending');

    const executed = await reconcileUploadQuotaUsage(true, now);
    expect(executed.mode).toBe('execute');
    const ledger = await UploadQuotaLedgerModel.findOne({ account_id: accountId }).lean();
    expect(ledger).toMatchObject({ activeBytes: 10, reservedBytes: 4 });
    await expect(UploadQuotaReservationModel.findOne({
      reservationId: 'expired'
    }).then((record) => record?.status)).resolves.toBe('expired');
  });
});
