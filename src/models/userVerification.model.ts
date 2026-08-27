import mongoose, { Schema } from "mongoose";
export const USER_VERIFICATION_COLLECTION_NAME = 'user_verification_code';


export const VERIFICATION_CODE_EXPIRY_SECONDS = 30 * 60;

export interface IVerificationCode {
  email: string;
  firstName: string;
  lastName?: string;
  code: string;
  createdAt: Date;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
}

const verificationCodeSchema = new Schema<IVerificationCode>({
  email: { type: String, trim: true, required: true },
  firstName: { type: String, trim: true, required: true },
  lastName: { type: String, trim: true },
  code: { type: String, trim: true, required: true },
  createdAt: { type: Date, default: Date.now, expires: VERIFICATION_CODE_EXPIRY_SECONDS },
  resetTokenHash: { type: String, select: false },
  resetTokenExpiresAt: { type: Date, select: false }
}, {
  collection: USER_VERIFICATION_COLLECTION_NAME,
  timestamps: true,
  versionKey: false
});

export const VerificationCodeModel = mongoose.model<IVerificationCode>('Schema_VerificationCode', verificationCodeSchema);
