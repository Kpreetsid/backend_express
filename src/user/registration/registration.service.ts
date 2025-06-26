import { Account, IAccount } from "../../models/account.model";
import { User, IUser } from "../../models/user.model";
import { UserRoleMenu, IUserRoleMenu} from "../../models/userRoleMenu.model";
import { NextFunction, Request, Response } from 'express';
import { hashPassword } from '../../_config/bcrypt';
import mongoose from "mongoose";
import { platformControlData } from "../../_config/userRoles";
import { sendMail } from '../../_config/mailer'
import fs from 'fs';
import path from 'path';
import { VerificationCode } from "../../models/userVerification.model";

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    const emailVerification = await sendVerificationCode(body.email, body.firstName, body.lastName);
    if (!emailVerification) {
      throw Object.assign(new Error('Email verification failed'), { status: 500 });
    }
    return res.status(201).json({ status: true, message: "Email verification code sent successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

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
    const safeUser = await createNewUser(body);
    if (!safeUser) {
      throw Object.assign(new Error('User creation failed'), { status: 500 });
    }
    const userRoleMenu: IUserRoleMenu = await createUserRoleMenu(safeUser._id as mongoose.Types.ObjectId, account._id as mongoose.Types.ObjectId);
    if (!userRoleMenu) {
      throw Object.assign(new Error('User role menu creation failed'), { status: 500 });
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
    const { email, firstName, lastName } = req.body;
    const emailVerification = await sendVerificationCode(email, firstName, lastName);
    if (!emailVerification) {
      throw Object.assign(new Error('Email verification failed'), { status: 500 });
    }
    return res.status(200).json({ status: true, message: "Email verification code sent successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const sendVerificationCode = async (email: string, firstName: string, lastName: string): Promise<boolean> => {
  try {
    const otp = Math.floor(100000 + Math.random() * 900000);
    const templatePath = path.join(__dirname, '../../public/verificationCode.template.html');
    let htmlTemplate = fs.readFileSync(templatePath, 'utf8');
    htmlTemplate = htmlTemplate.replace('{{OTP}}', otp.toString());
    htmlTemplate = htmlTemplate.replace('{{YEAR}}', new Date().getFullYear().toString());
    htmlTemplate = htmlTemplate.replace('{{NAME}}', firstName + ' ' + lastName);
    const mailResponse = await sendMail({
      to: email,
      subject: 'Verify Your Email Address',
      html: htmlTemplate
    });
    await new VerificationCode({ email, firstName, lastName, code: otp.toString() }).save();
    console.log(mailResponse);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

const createNewUser = async (body: IUser) => {
  try {
    const newUser = new User({
      firstName: body.firstName,
      lastName: body.lastName,
      username: body.username,
      email: body.email,
      isFirstUser: body.isFirstUser,
      user_role: body.user_role,
      user_status: body.user_status,
      phone_no: {
        number: body.phone_no.number,
        internationalNumber: body.phone_no.internationalNumber,
        nationalNumber: body.phone_no.nationalNumber,
        e164Number: body.phone_no.e164Number,
        countryCode: body.phone_no.countryCode,
        dialCode: body.phone_no.dialCode
      },
      password: await hashPassword(body.password),
      account_id: body.account_id,
      emailStatus: true,
      isVerified: true
    });
    const newUserData = await newUser.save();
    const { password, ...safeUser } = newUserData.toObject();
    return safeUser;
  } catch (error) {
    console.error("Error creating new user:", error);
    throw error;
  }
}

const createUserRoleMenu = async (userId: mongoose.Types.ObjectId, accountId: mongoose.Types.ObjectId) => {
  try {
    const newUserRoleMenu = new UserRoleMenu({
      user_id: userId,
      account_id: accountId,
      data: await platformControlData("admin")
    });
    const newUserRoleData = await newUserRoleMenu.save();
    return newUserRoleData.toObject();
  } catch (error) {
    console.error("Error creating user role menu:", error);
    throw error;
  }
}