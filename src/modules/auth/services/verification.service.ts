import { MailerService } from "../../../core/mailer/mailer.service";
import { VerificationCodeModel, VERIFICATION_CODE_EXPIRY_SECONDS } from '../models/userVerification.model';

class VerificationService {
    private mailerService: MailerService;

    constructor() {
        this.mailerService = new MailerService();
    }

    async sendVerificationEmailCode (match: { email: string; firstName: string; lastName: string }) {
        return await this.mailerService.sendVerificationCode(match);
    }
    
    async consumeUserOTP (email: string, code: string) {
        const createdAfter = new Date(Date.now() - VERIFICATION_CODE_EXPIRY_SECONDS * 1000);
        return await VerificationCodeModel.findOneAndDelete({
            email: String(email).trim().toLowerCase(),
            code: String(code),
            createdAt: { $gt: createdAfter }
        });
    }
    
}

export const verificationService = new VerificationService();
