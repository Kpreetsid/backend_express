import mongoose, { Schema } from "mongoose";

export interface IVerificationCode {
  email: string;
  firstName: string;
  lastName: string;
  code: string;
  createdAt: Date
}

const verificationCodeSchema = new Schema<IVerificationCode>({
  email: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  code: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60*30 }
}, {
  collection: 'user_verification_code',
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      ret.id = ret._id;
      return ret;
    }
  }
}
);

export const VerificationCode = mongoose.model<IVerificationCode>('VerificationCode', verificationCodeSchema);