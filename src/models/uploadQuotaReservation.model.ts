import { Document, Schema, Types, model } from 'mongoose';

export type UploadQuotaReservationStatus = 'pending' | 'committed' | 'released' | 'expired';

export interface IUploadQuotaReservation {
  reservationId: string;
  account_id: Types.ObjectId;
  bytes: number;
  status: UploadQuotaReservationStatus;
  storageKey?: string;
  expiresAt: Date;
  committedAt?: Date;
  releasedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUploadQuotaReservationDocument extends IUploadQuotaReservation, Document {}

const UploadQuotaReservationSchema = new Schema<IUploadQuotaReservationDocument>({
  reservationId: { type: String, required: true, trim: true, immutable: true },
  account_id: {
    type: Schema.Types.ObjectId,
    ref: 'Schema_Account',
    required: true,
    immutable: true
  },
  bytes: { type: Number, required: true, min: 1, immutable: true },
  status: {
    type: String,
    enum: ['pending', 'committed', 'released', 'expired'],
    required: true,
    default: 'pending'
  },
  storageKey: { type: String, trim: true },
  expiresAt: { type: Date, required: true, immutable: true },
  committedAt: { type: Date },
  releasedAt: { type: Date }
}, {
  collection: 'upload_quota_reservations',
  timestamps: true,
  versionKey: false
});

UploadQuotaReservationSchema.index({ reservationId: 1 }, { unique: true });
UploadQuotaReservationSchema.index({ account_id: 1, status: 1, createdAt: -1 });
UploadQuotaReservationSchema.index({ status: 1, expiresAt: 1 });

export const UploadQuotaReservationModel = model<IUploadQuotaReservationDocument>(
  'UploadQuotaReservation',
  UploadQuotaReservationSchema
);
