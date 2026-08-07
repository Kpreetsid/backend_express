import { Document, Schema, Types, model } from 'mongoose';

export type StoredUploadDriver = 'local' | 's3';
export type StoredUploadStatus = 'active' | 'deleted';

export interface IStoredUploadMetadata {
  account_id: Types.ObjectId;
  createdBy?: Types.ObjectId;
  originalName: string;
  fileName: string;
  folderName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  checksumSha256: string;
  storageDriver: StoredUploadDriver;
  scanStatus: 'clean';
  status: StoredUploadStatus;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStoredUploadMetadataDocument extends IStoredUploadMetadata, Document {}

const immutableString = {
  type: String,
  required: true,
  trim: true,
  immutable: true
} as const;

const StoredUploadMetadataSchema = new Schema<IStoredUploadMetadataDocument>({
  account_id: {
    type: Schema.Types.ObjectId,
    ref: 'Schema_Account',
    required: true,
    immutable: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    immutable: true
  },
  originalName: immutableString,
  fileName: immutableString,
  folderName: {
    type: String,
    default: '',
    trim: true,
    immutable: true
  },
  storageKey: immutableString,
  mimeType: immutableString,
  size: {
    type: Number,
    required: true,
    min: 0,
    immutable: true
  },
  checksumSha256: {
    ...immutableString,
    match: /^[a-f0-9]{64}$/
  },
  storageDriver: {
    type: String,
    enum: ['local', 's3'],
    required: true,
    immutable: true
  },
  scanStatus: {
    type: String,
    enum: ['clean'],
    default: 'clean',
    immutable: true
  },
  status: {
    type: String,
    enum: ['active', 'deleted'],
    default: 'active',
    required: true
  },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
  collection: 'stored_upload_metadata',
  timestamps: true,
  versionKey: false
});

StoredUploadMetadataSchema.index({ storageKey: 1 }, { unique: true });
StoredUploadMetadataSchema.index({ account_id: 1, status: 1, createdAt: -1 });
StoredUploadMetadataSchema.index({ account_id: 1, checksumSha256: 1 });

export const StoredUploadMetadataModel = model<IStoredUploadMetadataDocument>(
  'StoredUploadMetadata',
  StoredUploadMetadataSchema
);
