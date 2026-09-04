import crypto from 'crypto';
import { MailerService } from "../../../core/mailer/mailer.service";
import { VerificationCodeModel, VERIFICATION_CODE_EXPIRY_SECONDS } from '../models/userVerification.model';

export const RESET_PROOF_EXPIRY_MS = 10 * 60 * 1000;

class ResetPasswordService {
    private mailerService: MailerService;

    constructor() {
        this.mailerService = new MailerService();
    }

    async sendVerificationEmailCode (match: any) {
        return await this.mailerService.sendVerificationCode(match);
    }
    
    async createResetProof(email: string, verificationCode: string): Promise<string | null> {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedCode = String(verificationCode || '').trim();
        if (!normalizedEmail || !/^\d{6}$/.test(normalizedCode)) {
            return null;
        }

        const resetToken = crypto.randomBytes(32).toString('base64url');
        const resetTokenHash = this.hashResetToken(resetToken);
        const resetTokenExpiresAt = new Date(Date.now() + RESET_PROOF_EXPIRY_MS);
        const verificationCreatedAfter = new Date(Date.now() - VERIFICATION_CODE_EXPIRY_SECONDS * 1000);
        const verified = await VerificationCodeModel.findOneAndUpdate(
            { email: normalizedEmail, code: normalizedCode, createdAt: { $gt: verificationCreatedAfter } },
            { $set: { resetTokenHash, resetTokenExpiresAt } },
            { new: true }
        );

        return verified ? resetToken : null;
    }

    async consumeResetProof(email: string, resetToken: string): Promise<boolean> {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedToken = String(resetToken || '').trim();
        if (!normalizedEmail || normalizedToken.length < 32) {
            return false;
        }

        const result = await VerificationCodeModel.findOneAndDelete({
            email: normalizedEmail,
            resetTokenHash: this.hashResetToken(normalizedToken),
            resetTokenExpiresAt: { $gt: new Date() }
        });
        return !!result;
    }
    
    private hashResetToken(resetToken: string): string {
        return crypto.createHash('sha256').update(resetToken, 'utf8').digest('hex');
    }
}

export const resetPasswordService = new ResetPasswordService();
