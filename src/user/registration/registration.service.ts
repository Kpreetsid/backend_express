import { MailerService } from "../../_config/mailer";
import { companyService } from "../../masters/company/company.service";
import { usersService } from "../../masters/user/user.service";
import { IAccount } from "../../models/account.model";
import { verificationChallenges, verificationEmail, validateNewPassword } from '../verification/verification-challenge.service';
import { withTransaction } from "../../utils/transaction.helper";

class RegistrationService {
  private mailerService: MailerService;
  
  constructor() {
    this.mailerService = new MailerService();
  }
  async verifyOTPCode(body: any) {
    body.email = verificationEmail(body.email);
    validateNewPassword(body.password);
    await verificationChallenges.consumeOtp(body.email, body.verificationCode, 'registration');

    let createdAccountId: any = null;
    try {
      return await withTransaction(async (session) => {
        const accountBody = {
          account_name: body.account_name,
          type: body.type,
          experience_profile: body.experience_profile || 'standard_account',
          description: body.description
        };
        const account: IAccount = await companyService.createCompany(accountBody, session);
        if (!account) {
          throw Object.assign(new Error("Account creation failed"), { status: 500 });
        }
        createdAccountId = account._id;
        
        body.isFirstUser = true;
        body.user_role = "admin";
        body.isVerified = true;
        
        const userDetails = await usersService.createNewUser(body, account._id, session);
        if (!userDetails) {
          throw Object.assign(new Error("User creation failed"), { status: 500 });
        }
        
        await this.mailerService.sendRegistrationConfirmation(userDetails.userDetails, account);
        return userDetails;
      });
    } catch (error) {
      // Manual cleanup for standalone instances where transactions are not supported
      if (createdAccountId) {
        try {
          console.log(`Cleaning up account ${createdAccountId} due to registration failure...`);
          await companyService.removeById(createdAccountId, null);
        } catch (cleanupError) {
          console.error("Manual cleanup failed:", cleanupError);
        }
      }
      throw error;
    }
  }

  async emailVerificationCode(match: any) {
    return await this.mailerService.sendVerificationCode(match, 'registration');
  }
}

export const registrationService = new RegistrationService();
