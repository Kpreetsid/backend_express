import mongoose, { Schema, Document } from 'mongoose';

export const EXTERNAL_LOGIN_GRANT_COLLECTION = 'ExternalLoginGrant';

export interface IExternalLoginGrant extends Document {
  _id: string;
  issuer: 'internal-admin';
  audience: 'cmms-web';
  environment: 'staging' | 'production';
  companyId: mongoose.Types.ObjectId;
  actorId: string;
  targetUserId: mongoose.Types.ObjectId;
  purpose: 'support.login';
  stateHash: string;
  expiresAt: Date;
  consumedAt?: Date;
  createdAt: Date;
}

const externalLoginGrantSchema = new Schema<IExternalLoginGrant>({
  _id: { type: String, required: true },
  issuer: { type: String, enum: ['internal-admin'], required: true },
  audience: { type: String, enum: ['cmms-web'], required: true },
  environment: { type: String, enum: ['staging', 'production'], required: true, index: true },
  companyId: { type: Schema.Types.ObjectId, required: true, index: true },
  actorId: { type: String, required: true, trim: true, index: true },
  targetUserId: { type: Schema.Types.ObjectId, required: true, index: true },
  purpose: { type: String, enum: ['support.login'], required: true },
  stateHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  consumedAt: { type: Date }
}, {
  collection: EXTERNAL_LOGIN_GRANT_COLLECTION,
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false
});

externalLoginGrantSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
externalLoginGrantSchema.index({ actorId: 1, companyId: 1, environment: 1, expiresAt: 1 });

export const ExternalLoginGrantModel =
  mongoose.models.Schema_ExternalLoginGrant ||
  mongoose.model<IExternalLoginGrant>('Schema_ExternalLoginGrant', externalLoginGrantSchema);
