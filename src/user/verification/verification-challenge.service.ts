import crypto from 'node:crypto';
import { auth } from '../../configDB';
import { VerificationCodeModel, VERIFICATION_CODE_EXPIRY_SECONDS } from '../../models/userVerification.model';

export type VerificationPurpose = 'registration' | 'email-verification' | 'password-reset';
const RESET_GRANT_SECONDS = 5 * 60;
const invalid = () => Object.assign(new Error('Verification is invalid or expired. Please request a new code.'), { status: 410 });

export function verificationEmail(value: unknown): string {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    throw Object.assign(new Error('A valid email is required.'), { status: 400 });
  }
  return value.trim().toLowerCase();
}

function digest(purpose: string, value: string): string {
  if (!auth.secret) throw new Error('Verification signing key is not configured.');
  return `${purpose}:${crypto.createHmac('sha256', auth.secret).update(`${purpose}\0${value}`).digest('hex')}`;
}

function otpDigest(email: string, otp: unknown, purpose: VerificationPurpose): string {
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) throw invalid();
  return digest(`otp:${purpose}`, `${email}\0${otp}`);
}

function validSince(seconds: number): { $gt: Date; $lte: Date } {
  const now = Date.now();
  return { $gt: new Date(now - seconds * 1000), $lte: new Date(now) };
}
function challengeId(email: string): string {
  // Reuse the existing unique _id index; email has no unique index. No schema change.
  return crypto.createHash('sha256').update(`verification-challenge\0${email}`).digest('hex').slice(0, 24);
}

export const verificationChallenges = {
  async issueOtp(user: { email: string; firstName: string; lastName?: string }, purpose: VerificationPurpose): Promise<string> {
    const email = verificationEmail(user.email);
    const otp = String(crypto.randomInt(100000, 1000000));
    // One current challenge per email: issuing a new challenge also invalidates an older grant.
    await VerificationCodeModel.findOneAndUpdate({ _id: challengeId(email), email }, { $set: {
      email, firstName: user.firstName, lastName: user.lastName,
      code: otpDigest(email, otp, purpose), createdAt: new Date()
    } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, timestamps: false, overwriteImmutable: true });
    return otp;
  },

  async discardOtp(emailValue: string, otp: string, purpose: VerificationPurpose): Promise<void> {
    const email = verificationEmail(emailValue);
    await VerificationCodeModel.findOneAndDelete({ email, code: otpDigest(email, otp, purpose) });
  },

  async consumeOtp(emailValue: unknown, otp: unknown, purpose: VerificationPurpose): Promise<void> {
    const email = verificationEmail(emailValue);
    const record = await VerificationCodeModel.findOneAndDelete({
      email, code: otpDigest(email, otp, purpose), createdAt: validSince(VERIFICATION_CODE_EXPIRY_SECONDS)
    });
    if (!record) throw invalid();
  },

  async exchangeResetOtp(emailValue: unknown, otp: unknown): Promise<string> {
    const email = verificationEmail(emailValue);
    const resetToken = crypto.randomBytes(32).toString('base64url');
    const record = await VerificationCodeModel.findOneAndUpdate({
      email, code: otpDigest(email, otp, 'password-reset'), createdAt: validSince(VERIFICATION_CODE_EXPIRY_SECONDS)
    }, { $set: { code: digest('reset-grant', resetToken), createdAt: new Date() } },
    { returnDocument: 'after', timestamps: false, overwriteImmutable: true });
    if (!record) throw invalid();
    return resetToken;
  },

  async consumeResetToken(token: unknown, emailValue?: unknown): Promise<{ email: string }> {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw invalid();
    const record = await VerificationCodeModel.findOneAndDelete({
      ...(emailValue === undefined ? {} : { email: verificationEmail(emailValue) }),
      code: digest('reset-grant', token), createdAt: validSince(RESET_GRANT_SECONDS)
    });
    if (!record) throw invalid();
    return { email: record.email };
  }
};

export function validateNewPassword(password: unknown, confirmation: unknown = password): asserts password is string {
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72 ||
      !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) ||
      !/[!@#$%^&*(),.?":{}|<>]/.test(password) || password.includes('\0')) {
    throw Object.assign(new Error('Use a password of at least 8 characters with uppercase, lowercase, a number and a special character (maximum 72 bytes).'), { status: 400 });
  }
  if (confirmation !== password) throw Object.assign(new Error('Passwords do not match.'), { status: 400 });
}
