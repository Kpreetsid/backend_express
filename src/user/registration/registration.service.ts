import { Account, IAccount } from "../../models/account.model";
import { IUser } from "../../models/user.model";
import { NextFunction, Request, Response } from 'express';
import { sendVerificationCode } from '../../_config/mailer'
import { VerificationCode } from "../../models/userVerification.model";
import { createNewUser, getAllUsers } from "../../masters/user/user.service";

export const verifyOTPCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    const userVerification = await VerificationCode.findOne({ email: body.email, code: body.verificationCode });
    if (!userVerification) {
      throw Object.assign(new Error('OTP expired'), { status: 403 });
    }
    const account: IAccount = await Account.create(new Account({
      account_name: body.account_name,
      type: body.type,
      description: body.description
    }));
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
    return res.status(200).json({ status: true, message: "OTP code verified successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const emailVerificationCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, firstName = "", lastName = "" } = req.body;
    const userData: IUser[] = await getAllUsers({ email: email });
    console.log({ email, firstName, lastName, userData });
    const match: any = { email: email };
    if (userData) {
      match.firstName = userData[0].firstName;
      match.lastName = userData[0].lastName;
    }
    console.log(match);
    const emailVerification = await sendVerificationCode(match);
    console.log(emailVerification);
    if (!emailVerification) {
      throw Object.assign(new Error('Email verification failed'), { status: 500 });
    }
    return res.status(200).json({ status: true, message: "Email verification code sent successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
}