import { IAccount } from "../../models/account.model";
import { MailerService } from "../../_config/mailer";
import { VerificationCodeModel } from "../../models/userVerification.model";
import { usersService } from "../../masters/user/user.service";
import { companyService } from "../../masters/company/company.service";

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
    if (otpExists.code !== body.verificationCode) {
      throw Object.assign(new Error('invalid OTP (One Time Password)'), { status: 400 });
    }
    const userVerification = otpExists;
    const accountBody = { account_name: body.account_name, type: body.type, description: body.description };
    const account: IAccount = await companyService.createCompany(accountBody);
    if (!account) {
      throw Object.assign(new Error("Account creation failed"), { status: 500 });
    }
    body.isFirstUser = true;
    body.user_role = "admin";
    body.isVerified = true;
    const userDetails = await usersService.createNewUser(body, account._id);
    if (!userDetails) {
      throw Object.assign(new Error("User creation failed"), { status: 500 });
    }
    await this.mailerService.sendRegistrationConfirmation(userDetails.userDetails);
    await userVerification.deleteOne({ email: body.email, code: body.verificationCode });
    return userDetails;
  }

  async emailVerificationCode(match: any) {
    return await this.mailerService.sendVerificationCode(match);
  }
}

export const registrationService = new RegistrationService();