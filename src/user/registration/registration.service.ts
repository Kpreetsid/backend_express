import { IAccount } from "../../models/account.model";
import { sendVerificationCode } from '../../_config/mailer'
import { VerificationCode } from "../../models/userVerification.model";
import { createNewUser } from "../../masters/user/user.service";
import { createCompany } from "../../masters/company/company.service";

export const verifyOTPCode = async (body: any) => {
  const userVerification = await VerificationCode.findOne({ email: body.email, code: body.verificationCode });
  if (!userVerification) {
    throw Object.assign(new Error('OTP expired'), { status: 403 });
  }
  const accountBody = {
    account_name: body.account_name,
    type: body.type,
    description: body.description
  };
  const account: IAccount = await createCompany(accountBody);
  if (!account) {
    throw Object.assign(new Error('Account creation failed'), { status: 500 });
  }
  body.account_id = account._id;
  body.isFirstUser = true;
  body.user_role = "admin";
  body.isVerified = true;
  const userDetails = await createNewUser(body);
  if (!userDetails) {
    throw Object.assign(new Error('User creation failed'), { status: 500 });
  }
  await userVerification.deleteOne({ email: body.email, code: body.verificationCode });
  return userDetails;
};

export const emailVerificationCode = async (match: any) => {
  return await sendVerificationCode(match);
}