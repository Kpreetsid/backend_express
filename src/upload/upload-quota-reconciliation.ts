import { Types } from 'mongoose';
import { StoredUploadMetadataModel } from '../models/storedUploadMetadata.model';
import { UploadQuotaLedgerModel } from '../models/uploadQuotaLedger.model';
import { UploadQuotaReservationModel } from '../models/uploadQuotaReservation.model';

export interface UploadQuotaReconciliationEntry {
  accountId: string;
  currentActiveBytes: number;
  currentReservedBytes: number;
  expectedActiveBytes: number;
  expectedReservedBytes: number;
  driftBytes: number;
}

export interface UploadQuotaReconciliationReport {
  mode: 'dry-run' | 'execute';
  generatedAt: string;
  expiredReservations: number;
  totals: {
    accounts: number;
    accountsWithDrift: number;
    activeBytes: number;
    reservedBytes: number;
  };
  entries: UploadQuotaReconciliationEntry[];
}

type UsageRow = { _id: Types.ObjectId; bytes: number };

export const reconcileUploadQuotaUsage = async (
  execute = false,
  now = new Date()
): Promise<UploadQuotaReconciliationReport> => {
  let expiredReservations = await UploadQuotaReservationModel.countDocuments({
    status: 'pending',
    expiresAt: { $lte: now }
  });
  if (execute && expiredReservations > 0) {
    const result = await UploadQuotaReservationModel.updateMany(
      { status: 'pending', expiresAt: { $lte: now } },
      { $set: { status: 'expired', releasedAt: now } }
    );
    expiredReservations = result.modifiedCount;
  }

  const [activeRows, reservedRows, ledgers] = await Promise.all([
    StoredUploadMetadataModel.aggregate<UsageRow>([
      { $match: { status: 'active' } },
      { $group: { _id: '$account_id', bytes: { $sum: '$size' } } }
    ]),
    UploadQuotaReservationModel.aggregate<UsageRow>([
      { $match: { status: 'pending', expiresAt: { $gt: now } } },
      { $group: { _id: '$account_id', bytes: { $sum: '$bytes' } } }
    ]),
    UploadQuotaLedgerModel.find({}).lean()
  ]);

  const activeByAccount = new Map(activeRows.map((row) => [String(row._id), Number(row.bytes)]));
  const reservedByAccount = new Map(reservedRows.map((row) => [String(row._id), Number(row.bytes)]));
  const ledgerByAccount = new Map(ledgers.map((row) => [String(row.account_id), row]));
  const accountIds = [...new Set([
    ...activeByAccount.keys(),
    ...reservedByAccount.keys(),
    ...ledgerByAccount.keys()
  ])].sort();

  const entries = accountIds.map((accountId): UploadQuotaReconciliationEntry => {
    const ledger = ledgerByAccount.get(accountId);
    const currentActiveBytes = Number(ledger?.activeBytes || 0);
    const currentReservedBytes = Number(ledger?.reservedBytes || 0);
    const expectedActiveBytes = activeByAccount.get(accountId) || 0;
    const expectedReservedBytes = reservedByAccount.get(accountId) || 0;
    return {
      accountId,
      currentActiveBytes,
      currentReservedBytes,
      expectedActiveBytes,
      expectedReservedBytes,
      driftBytes: (currentActiveBytes + currentReservedBytes)
        - (expectedActiveBytes + expectedReservedBytes)
    };
  });

  if (execute && entries.length > 0) {
    await UploadQuotaLedgerModel.bulkWrite(entries.map((entry) => ({
      updateOne: {
        filter: { account_id: new Types.ObjectId(entry.accountId) },
        update: {
          $set: {
            activeBytes: entry.expectedActiveBytes,
            reservedBytes: entry.expectedReservedBytes
          }
        },
        upsert: true
      }
    })));
  }

  return {
    mode: execute ? 'execute' : 'dry-run',
    generatedAt: now.toISOString(),
    expiredReservations,
    totals: {
      accounts: entries.length,
      accountsWithDrift: entries.filter((entry) => entry.driftBytes !== 0).length,
      activeBytes: entries.reduce((total, entry) => total + entry.expectedActiveBytes, 0),
      reservedBytes: entries.reduce((total, entry) => total + entry.expectedReservedBytes, 0)
    },
    entries
  };
};
