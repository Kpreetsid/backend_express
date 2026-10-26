import { MailerService } from "../../../core/mailer/mailer.service";
import { verificationChallenges } from './verification-challenge.service';

class VerificationService {
    private mailerService: MailerService;

    constructor() {
        this.mailerService = new MailerService();
    }

    async sendVerificationEmailCode (match: { email: string; firstName: string; lastName: string }) {
        return await this.mailerService.sendVerificationCode(match, 'email-verification');
    }
    
    async verifyUserOTP (match: { email: string; firstName: string; lastName: string; code: string }) {
        await verificationChallenges.consumeOtp(match.email, match.code, 'email-verification');
        return true;
    }
}

export const verificationService = new VerificationService();
