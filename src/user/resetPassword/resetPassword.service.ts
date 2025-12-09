import { sendVerificationCode } from "../../_config/mailer";
import { VerificationCodeModel } from "../../models/userVerification.model";

class ResetPasswordService {
    async sendVerificationEmailCode (match: any) {
        return await sendVerificationCode(match);
    }
    
    async verifyOTPExists (match: any) {
        return await VerificationCodeModel.findOne(match);
    }
    
    async verifyUserOTP (match: any) {
        return await VerificationCodeModel.findOne(match);
    }
    
    async deleteVerificationCode (match: { email: string }) {
        return await VerificationCodeModel.deleteOne(match);
    }
}

export const resetPasswordService = new ResetPasswordService();