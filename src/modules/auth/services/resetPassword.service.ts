import { MailerService } from "../../../core/mailer/mailer.service";
import { UserModel } from '../../users/models/user.model';
import { usersService } from '../../users/services/user.service';
import { verificationChallenges, validateNewPassword } from './verification-challenge.service';

class ResetPasswordService {
    private mailerService: MailerService;

    constructor() {
        this.mailerService = new MailerService();
    }

    async sendVerificationEmailCode (match: any) {
        return await this.mailerService.sendVerificationCode(match, 'password-reset');
    }
    
    async verifyUserOTP (match: any) {
        return { resetToken: await verificationChallenges.exchangeResetOtp(match.email, match.code) };
    }
    
    async completeReset(input: { email?: unknown; token: unknown; password: unknown; confirmation?: unknown }): Promise<void> {
        validateNewPassword(input.password, input.confirmation);
        const verified = await verificationChallenges.consumeResetToken(input.token, input.email);
        const user = await UserModel.findOne({ email: verified.email, user_status: 'active', visible: { $ne: false } });
        if (!user) throw Object.assign(new Error('Recovery is invalid. Please request a new code.'), { status: 410 });
        // Failed writes never restore a consumed proof.
        await usersService.updateUserPassword(user._id, input.password, user.account_id);
    }
}

export const resetPasswordService = new ResetPasswordService();
