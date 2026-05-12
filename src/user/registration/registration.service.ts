import { MailerService } from "../../_config/mailer";
import { companyService } from "../../masters/company/company.service";
import { usersService } from "../../masters/user/user.service";
import { IAccount } from "../../models/account.model";
import { VerificationCodeModel } from "../../models/userVerification.model";
import { withTransaction } from "../../utils/transaction.helper";

class RegistrationService {
  private mailerService: MailerService;
  
  constructor() {
    this.mailerService = new MailerService();
  }
  async verifyOTPCode(body: any) {
    const otpExists = await VerificationCodeModel.findOne({ email: body.email });
    if (!otpExists) {
      throw Object.assign(new Error('OTP has expired. Please request a new one.'), { status: 410 });
    }
    if (otpExists.code !== body.verificationCode.toString()) {
      throw Object.assign(new Error('invalid OTP (One Time Password)'), { status: 400 });
    }

    let createdAccountId: any = null;
    try {
      return await withTransaction(async (session) => {
        const userVerification = otpExists;
        const accountBody = { account_name: body.account_name, type: body.type, description: body.description };
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
        
        await this.mailerService.sendRegistrationConfirmation(userDetails.userDetails);
        await userVerification.deleteOne({ session });
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
    return await this.mailerService.sendVerificationCode(match);
  }
}

export const registrationService = new RegistrationService();