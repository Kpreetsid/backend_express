import mongoose, { Schema } from "mongoose";

export interface IVerificationCode {
  email: string;
  firstName: string;
  lastName?: string;
  code: string;
  createdAt: Date
}

const verificationCodeSchema = new Schema<IVerificationCode>({
  email: { type: String, trim: true, required: true },
  firstName: { type: String, trim: true, required: true },
  lastName: { type: String, trim: true },
  code: { type: String, trim: true, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 }
}, {
  collection: 'user_verification_code',
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  }
});

export const VerificationCodeModel = mongoose.model<IVerificationCode>('Schema_VerificationCode', verificationCodeSchema);