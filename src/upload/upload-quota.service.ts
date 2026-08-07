import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { uploadQuotaConfig } from '../configDB';
import { UploadQuotaLedgerModel } from '../models/uploadQuotaLedger.model';
import { UploadQuotaReservationModel } from '../models/uploadQuotaReservation.model';

export interface UploadQuotaReservation {
  reservationId: string;
  accountId: string;
  bytes: number;
}

const objectId = (value: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw Object.assign(new Error('accountId is invalid'), { status: 400 });
  }
  return new Types.ObjectId(value);
};

class UploadQuotaService {
  async reserve(accountId: string, bytes: number): Promise<UploadQuotaReservation | null> {
    const quotaBytes = uploadQuotaConfig.tenantQuotaBytes;
    if (quotaBytes <= 0) return null;
    if (!Number.isSafeInteger(bytes) || bytes <= 0) {
      throw Object.assign(new Error('Upload size is invalid'), { status: 400 });
    }

    const tenantId = objectId(accountId);
    await UploadQuotaLedgerModel.updateOne(
      { account_id: tenantId },
      { $setOnInsert: { account_id: tenantId, activeBytes: 0, reservedBytes: 0 } },
      { upsert: true }
    );

    const ledger = await UploadQuotaLedgerModel.findOneAndUpdate(
      {
        account_id: tenantId,
        $expr: {
          $lte: [
            {
              $add: [
                { $ifNull: ['$activeBytes', 0] },
                { $ifNull: ['$reservedBytes', 0] },
                bytes
              ]
            },
            quotaBytes
          ]
        }
      },
      { $inc: { reservedBytes: bytes } },
      { returnDocument: 'after' }
    );

    if (!ledger) {
      const current = await UploadQuotaLedgerModel.findOne({ account_id: tenantId }).lean();
      const usedBytes = Number(current?.activeBytes || 0) + Number(current?.reservedBytes || 0);
      throw Object.assign(new Error('Tenant upload storage quota exceeded'), {
        status: 507,
        data: {
          code: 'UPLOAD_QUOTA_EXCEEDED',
          quotaBytes,
          usedBytes,
          remainingBytes: Math.max(0, quotaBytes - usedBytes),
          requestedBytes: bytes
        }
      });
    }

    const reservationId = randomUUID();
    try {
      await UploadQuotaReservationModel.create({
        reservationId,
        account_id: tenantId,
        bytes,
        status: 'pending',
        expiresAt: new Date(Date.now() + uploadQuotaConfig.reservationTtlSeconds * 1000)
      });
    } catch (error) {
      await UploadQuotaLedgerModel.updateOne(
        { account_id: tenantId },
        { $inc: { reservedBytes: -bytes } }
      );
      throw error;
    }

    return { reservationId, accountId, bytes };
  }

  async commit(reservation: UploadQuotaReservation | null, storageKey: string): Promise<void> {
    if (!reservation) return;
    const committed = await UploadQuotaReservationModel.findOneAndUpdate(
      { reservationId: reservation.reservationId, status: 'pending' },
      {
        $set: {
          status: 'committed',
          storageKey,
          committedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    if (!committed) return;
    await UploadQuotaLedgerModel.updateOne(
      { account_id: objectId(reservation.accountId) },
      {
        $inc: {
          reservedBytes: -reservation.bytes,
          activeBytes: reservation.bytes
        }
      }
    );
  }

  async release(reservation: UploadQuotaReservation | null): Promise<void> {
    if (!reservation) return;
    const released = await UploadQuotaReservationModel.findOneAndUpdate(
      { reservationId: reservation.reservationId, status: 'pending' },
      { $set: { status: 'released', releasedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!released) return;
    await UploadQuotaLedgerModel.updateOne(
      { account_id: objectId(reservation.accountId) },
      { $inc: { reservedBytes: -reservation.bytes } }
    );
  }

  async releaseActive(accountId: string, bytes: number): Promise<void> {
    if (uploadQuotaConfig.tenantQuotaBytes <= 0 || bytes <= 0) return;
    await UploadQuotaLedgerModel.updateOne(
      { account_id: objectId(accountId) },
      [{
        $set: {
          activeBytes: { $max: [0, { $subtract: ['$activeBytes', bytes] }] }
        }
      }],
      { updatePipeline: true }
    );
  }
}

export const uploadQuotaService = new UploadQuotaService();
