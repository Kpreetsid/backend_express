import { MailerService } from "../../_config/mailer";
import { VerificationCodeModel } from "../../models/userVerification.model";

class VerificationService {
    private mailerService: MailerService;

    constructor() {
        this.mailerService = new MailerService();
    }

    async sendVerificationEmailCode (match: { email: string; firstName: string; lastName: string }) {
        return await this.mailerService.sendVerificationCode(match);
    }
    
    async verifyOTPExists (match: { email: string; firstName: string; lastName: string }) {
        return await VerificationCodeModel.findOne(match);
    }
    
    async verifyUserOTP (match: { email: string; firstName: string; lastName: string; code: string }) {
        return await VerificationCodeModel.findOne(match);
    }
    
    async deleteVerificationCode (match: { email: string }) {
        return await VerificationCodeModel.deleteOne(match);
    }
}

export const verificationService = new VerificationService();