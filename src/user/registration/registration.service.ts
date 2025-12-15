import { IAccount } from "../../models/account.model";
import { sendRegistrationConfirmation, sendVerificationCode } from "../../_config/mailer";
import { VerificationCodeModel } from "../../models/userVerification.model";
import { usersService } from "../../masters/user/user.service";
import { companyService } from "../../masters/company/company.service";

class RegistrationService {
  async verifyOTPCode(body: any) {
    const userVerification = await VerificationCodeModel.findOne({
      email: body.email,
      code: body.verificationCode,
    });
    if (!userVerification) {
      throw Object.assign(new Error("OTP expired"), { status: 403 });
    }
    const accountBody = {
      account_name: body.account_name,
      type: body.type,
      description: body.description,
    };
    const account: IAccount = await companyService.createCompany(accountBody);
    if (!account) {
      throw Object.assign(new Error("Account creation failed"), {
        status: 500,
      });
    }
    body.isFirstUser = true;
    body.user_role = "admin";
    body.emailStatus = true;
    body.isVerified = true;
    const userDetails = await usersService.createNewUser(body, account._id);
    if (!userDetails) {
      throw Object.assign(new Error("User creation failed"), { status: 500 });
    }
    await sendRegistrationConfirmation(userDetails.userDetails);
    await userVerification.deleteOne({
      email: body.email,
      code: body.verificationCode,
    });
    return userDetails;
  }

  async emailVerificationCode(match: any) {
    return await sendVerificationCode(match);
  }
}

export const registrationService = new RegistrationService();