import { sendVerificationCode } from "../../_config/mailer";
import { VerificationCodeModel } from "../../models/userVerification.model";

class VerificationService {
    async sendVerificationEmailCode (match: { email: string; firstName: string; lastName: string }) {
        return await sendVerificationCode(match);
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