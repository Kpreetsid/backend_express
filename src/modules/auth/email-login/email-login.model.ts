import mongoose, { Schema } from 'mongoose';

export interface EmailCredential {
  credentialId: string;
  userId: string;
  accountId: string;
  dispatchId: string;
  mailCategory: string;
  tokenDigest: string;
  destination: string;
  issuedAt: Date;
  expiresAt: Date;
  keyId: string;
  revokedAt?: Date;
  revokedBy?: string;
  revokeReason?: string;
  lastUsedAt?: Date;
  useCount: number;
}

const schema = new Schema<EmailCredential>({
  credentialId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  accountId: { type: String, required: true },
  dispatchId: { type: String, required: true },
  mailCategory: { type: String, required: true },
  tokenDigest: { type: String, required: true, select: false },
  destination: { type: String, required: true },
  issuedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  keyId: { type: String, required: true },
  revokedAt: Date,
  revokedBy: String,
  revokeReason: String,
  lastUsedAt: Date,
  useCount: { type: Number, default: 0 }
}, { collection: 'email_login_credentials', timestamps: true, versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ accountId: 1, userId: 1 });
export const EmailLoginCredentialModel = mongoose.model<EmailCredential>('EmailLoginCredential', schema);
