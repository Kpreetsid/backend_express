import { MailerService } from "../../_config/mailer";
import { VerificationCodeModel } from "../../models/userVerification.model";
import { passwordResetAuthorizationService } from "./passwordResetAuthorization.service";

class ResetPasswordService {
    private mailerService: MailerService;

    constructor() {
        this.mailerService = new MailerService();
    }

    async sendVerificationEmailCode (match: any) {
        return await this.mailerService.sendVerificationCode(match);
    }
    
    async verifyOTPExists (match: any) {
        return await VerificationCodeModel.findOne(match);
    }
    
    async verifyUserOTP (match: any) {
        return await passwordResetAuthorizationService.markPasswordResetVerified(
            String(match.email),
            String(match.code)
        );
    }

    async consumePasswordResetAuthorization (email: string) {
        return await passwordResetAuthorizationService.consumePasswordResetAuthorization(email);
    }
    
    async deleteVerificationCode (match: { email: string }) {
        return await VerificationCodeModel.deleteOne(match);
    }
}

export const resetPasswordService = new ResetPasswordService();
