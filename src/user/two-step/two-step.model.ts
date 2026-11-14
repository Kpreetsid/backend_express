import mongoose, { Schema } from 'mongoose';

export interface TwoStepRecord {
  _id: string;
  version: number;
  accountId: string;
  userId: string;
  challengeDigest: string | null;
  codeDigest: string | null;
  credentialDigest: string | null;
  policyRevision: number;
  responseMode: 'login' | 'authenticate';
  sessionStartedAt: number;
  expiresAt: Date;
  attempts: number;
  attemptWindowStartedAt: Date;
  consumedAt: Date | null;
  deliveryState: 'pending' | 'ready' | 'invalid' | 'consumed';
  nextSendAt: Date;
  sendTimes: Date[];
  lockedUntil: Date;
  purgeAt: Date;
}

export const twoStepSchema = new Schema<TwoStepRecord>({
  // The unique _id index guarantees one record per principal before secondary
  // indexes are built. SHA-256 string IDs are never cast to ObjectId.
  _id: { type: String, required: true },
  version: { type: Number, required: true },
  accountId: { type: String, required: true },
  userId: { type: String, required: true },
  challengeDigest: { type: String, default: null },
  codeDigest: { type: String, default: null },
  credentialDigest: { type: String, default: null },
  policyRevision: { type: Number, required: true },
  responseMode: { type: String, enum: ['login', 'authenticate'], required: true },
  sessionStartedAt: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, required: true },
  attemptWindowStartedAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null },
  deliveryState: { type: String, enum: ['pending', 'ready', 'invalid', 'consumed'], required: true },
  nextSendAt: { type: Date, required: true },
  sendTimes: { type: [Date], required: true },
  lockedUntil: { type: Date, required: true },
  purgeAt: { type: Date, required: true }
}, { collection: 'user_auth_code', versionKey: false, timestamps: false });

twoStepSchema.index({ challengeDigest: 1 });
// Cleanup is later than every limit window; validity never relies on TTL.
twoStepSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
export const TwoStepChallengeModel = mongoose.model<TwoStepRecord>('UserLoginTwoStepChallenge', twoStepSchema);

export interface TwoStepStore {
  read(filter: Record<string, unknown>): Promise<TwoStepRecord | null>;
  initialize(record: TwoStepRecord): Promise<void>;
  compareAndSet(filter: Record<string, unknown>, record: TwoStepRecord): Promise<boolean>;
}

export const twoStepStore: TwoStepStore = {
  async read(filter) { return TwoStepChallengeModel.findOne(filter).lean<TwoStepRecord>(); },
  async initialize(record) {
    try {
      await TwoStepChallengeModel.updateOne({ _id: record._id }, { $setOnInsert: record }, { upsert: true });
    } catch (error: any) {
      // Concurrent first issuance may lose the unique _id insertion race.
      if (error?.code !== 11000) throw error;
    }
  },
  async compareAndSet(filter, record) {
    const { _id, ...fields } = record;
    const result = await TwoStepChallengeModel.updateOne(filter, { $set: fields });
    return result.matchedCount === 1;
  }
};
