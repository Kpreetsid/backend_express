import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { uploadQuotaConfig } from '../configDB';
import { UploadQuotaLedgerModel } from '../models/uploadQuotaLedger.model';
import { UploadQuotaReservationModel } from '../models/uploadQuotaReservation.model';
import { uploadQuotaService } from './upload-quota.service';

describe('atomic tenant upload quota', () => {
  let mongo: MongoMemoryServer;
  const originalQuota = uploadQuotaConfig.tenantQuotaBytes;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Promise.all([
      UploadQuotaLedgerModel.syncIndexes(),
      UploadQuotaReservationModel.syncIndexes()
    ]);
  }, 60_000);

  afterEach(async () => {
    uploadQuotaConfig.tenantQuotaBytes = originalQuota;
    await Promise.all([
      UploadQuotaLedgerModel.deleteMany({}),
      UploadQuotaReservationModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('admits concurrent reservations only while the tenant total remains within quota', async () => {
    uploadQuotaConfig.tenantQuotaBytes = 10;
    const accountId = new Types.ObjectId();
    await UploadQuotaLedgerModel.create({ account_id: accountId });

    const results = await Promise.allSettled([
      uploadQuotaService.reserve(String(accountId), 4),
      uploadQuotaService.reserve(String(accountId), 4),
      uploadQuotaService.reserve(String(accountId), 4)
    ]);

    const accepted = results
      .filter((result): result is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof uploadQuotaService.reserve>>>> =>
        result.status === 'fulfilled' && result.value !== null)
      .map((result) => result.value);
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(accepted).toHaveLength(2);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      status: 507,
      data: {
        code: 'UPLOAD_QUOTA_EXCEEDED',
        quotaBytes: 10,
        usedBytes: 8,
        remainingBytes: 2,
        requestedBytes: 4
      }
    });

    const ledger = await UploadQuotaLedgerModel.findOne({ account_id: accountId }).lean();
    expect(ledger).toMatchObject({ activeBytes: 0, reservedBytes: 8 });
  });

  it('moves reserved bytes to active exactly once and releases deleted usage safely', async () => {
    uploadQuotaConfig.tenantQuotaBytes = 100;
    const accountId = new Types.ObjectId();
    const reservation = await uploadQuotaService.reserve(String(accountId), 25);
    await uploadQuotaService.commit(reservation, 'assets/file.png');
    await uploadQuotaService.commit(reservation, 'assets/file.png');

    let ledger = await UploadQuotaLedgerModel.findOne({ account_id: accountId }).lean();
    expect(ledger).toMatchObject({ activeBytes: 25, reservedBytes: 0 });
    await expect(UploadQuotaReservationModel.countDocuments({
      status: 'committed'
    })).resolves.toBe(1);

    await uploadQuotaService.releaseActive(String(accountId), 25);
    await uploadQuotaService.releaseActive(String(accountId), 25);
    ledger = await UploadQuotaLedgerModel.findOne({ account_id: accountId }).lean();
    expect(ledger).toMatchObject({ activeBytes: 0, reservedBytes: 0 });
  });

  it('rolls back a pending reservation exactly once after storage failure', async () => {
    uploadQuotaConfig.tenantQuotaBytes = 100;
    const accountId = new Types.ObjectId();
    const reservation = await uploadQuotaService.reserve(String(accountId), 30);
    await uploadQuotaService.release(reservation);
    await uploadQuotaService.release(reservation);

    const ledger = await UploadQuotaLedgerModel.findOne({ account_id: accountId }).lean();
    expect(ledger).toMatchObject({ activeBytes: 0, reservedBytes: 0 });
    const record = await UploadQuotaReservationModel.findOne({
      reservationId: reservation!.reservationId
    }).lean();
    expect(record?.status).toBe('released');
  });

  it('keeps development uploads unlimited when no quota is configured', async () => {
    uploadQuotaConfig.tenantQuotaBytes = 0;
    await expect(uploadQuotaService.reserve(String(new Types.ObjectId()), 1024))
      .resolves.toBeNull();
    await expect(UploadQuotaLedgerModel.countDocuments({})).resolves.toBe(0);
  });
});
