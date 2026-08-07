import mongoose, { Schema } from "mongoose";

export const VERIFICATION_CODE_EXPIRY_SECONDS = 30 * 60;

export interface IVerificationCode {
  email: string;
  firstName: string;
  lastName?: string;
  code: string;
  createdAt: Date;
  verificationPurpose?: 'password_reset';
  verifiedAt?: Date;
}

const verificationCodeSchema = new Schema<IVerificationCode>({
  email: { type: String, trim: true, required: true },
  firstName: { type: String, trim: true, required: true },
  lastName: { type: String, trim: true },
  code: { type: String, trim: true, required: true },
  createdAt: { type: Date, default: Date.now, expires: VERIFICATION_CODE_EXPIRY_SECONDS },
  verificationPurpose: {
    type: String,
    enum: ['password_reset']
  },
  verifiedAt: { type: Date }
}, {
  collection: 'user_verification_code',
  timestamps: true,
  versionKey: false
});

export const VerificationCodeModel = mongoose.model<IVerificationCode>('Schema_VerificationCode', verificationCodeSchema);
