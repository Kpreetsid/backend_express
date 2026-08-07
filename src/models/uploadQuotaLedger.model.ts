import { Document, Schema, Types, model } from 'mongoose';

export interface IUploadQuotaLedger {
  account_id: Types.ObjectId;
  activeBytes: number;
  reservedBytes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUploadQuotaLedgerDocument extends IUploadQuotaLedger, Document {}

const UploadQuotaLedgerSchema = new Schema<IUploadQuotaLedgerDocument>({
  account_id: {
    type: Schema.Types.ObjectId,
    ref: 'Schema_Account',
    required: true,
    immutable: true
  },
  activeBytes: { type: Number, required: true, min: 0, default: 0 },
  reservedBytes: { type: Number, required: true, min: 0, default: 0 }
}, {
  collection: 'upload_quota_ledgers',
  timestamps: true,
  versionKey: false
});

UploadQuotaLedgerSchema.index({ account_id: 1 }, { unique: true });

export const UploadQuotaLedgerModel = model<IUploadQuotaLedgerDocument>(
  'UploadQuotaLedger',
  UploadQuotaLedgerSchema
);
