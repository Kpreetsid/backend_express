import mongoose, { Schema, Model, InferSchemaType } from 'mongoose';

export const SUPPORT_LOGIN_TTL_MS = 5 * 60 * 1000;

export interface SupportLoginInput {
  userId: string;
  accountId: string;
  actorId: string;
  reason: string;
}

const schema = new Schema({
  digest: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  accountId: { type: Schema.Types.ObjectId, required: true },
  actorId: { type: String, required: true },
  reason: { type: String, required: true },
  issuedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  consumedAt: Date
}, { collection: 'support_login_credentials', versionKey: false });

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SupportCredential = InferSchemaType<typeof schema>;

export const SupportLoginCredential: Model<SupportCredential> =
  (mongoose.models.SupportLoginCredential as Model<SupportCredential> | undefined)
  || mongoose.model<SupportCredential>('SupportLoginCredential', schema);
