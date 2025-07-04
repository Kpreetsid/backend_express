import { IUser, User, UserLoginPayload } from "../../models/user.model";
import { Request, Response, NextFunction } from 'express';
import { comparePassword, hashPassword } from '../../_config/bcrypt';
import { generateAccessToken } from '../../_config/auth';
import { UserToken } from "../../models/userToken.model";
import { verifyUserRole } from "../../masters/user/role/roles.service";
import path from "path";
import fs from "fs";
import { sendMail } from "../../_config/mailer";
import { VerificationCode } from "../../models/userVerification.model";
import { auth } from "../../configDB";
import { IAccount } from "../../models/account.model";
import { getAllCompanies } from "../../masters/company/company.service";
import { get } from "lodash";

export const userAuthentication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const user: IUser | null = await User.findOne({ username: username, user_status: 'active' }).select('+password');
    if (!user) {
      throw Object.assign(new Error('User data not found'), { status: 404 });
    }
    if(!user.isVerified) {
      throw Object.assign(new Error('User is not verified'), { status: 403 });
    }
    const accountMatch = { _id: user.account_id };
    const userAccount: IAccount[] | null = await getAllCompanies(accountMatch);
    if (!userAccount || userAccount.length === 0) {
      throw Object.assign(new Error('User account not found'), { status: 404 });
    }
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }
    const { password: _, ...safeUser } = user.toObject();
    const userTokenPayload: UserLoginPayload = { id: `${user._id}`, username: user.username, email: user.email, companyID: `${user.account_id}` };
    const token = generateAccessToken(userTokenPayload);
    const userRoleData = await verifyUserRole(`${user._id}`, `${user.account_id}`);
    if (!userRoleData) {
      throw Object.assign(new Error('User does not have any permission'), { status: 403 });
    }
    res.cookie('token', token, { httpOnly: true, secure: false , sameSite: 'lax'});
    res.cookie('accountID', userTokenPayload.companyID, { httpOnly: true, secure: false, sameSite: 'lax' });
    const userTokenData = new UserToken({
      _id: token,
      userId: user._id,
      principalType: 'user',
      ttl: parseInt(auth.expiresIn as string)
    });
    await userTokenData.save();
    res.status(200).json({ status: true, message: 'Login successful', data: {token, accountDetails: userAccount[0], userDetails: safeUser, platformControl: userRoleData.data} });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const userResetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = req.body;
    if(!token) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const userToken = await UserToken.findOne({ _id: token });
    if (!userToken) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const user = await User.findOne({ _id: userToken.userId });
    if (!user) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const hashNewPassword = await hashPassword(password);
    await User.updateOne({ _id: user._id, account_id: user.account_id }, { $set: { password: hashNewPassword } });
    await VerificationCode.deleteOne({ email: user.email, code: token.toString() });

    const templatePath = path.join(__dirname, '../../public/confirmPasswordChange.template.html');
    let htmlTemplate = fs.readFileSync(templatePath, 'utf8');
    htmlTemplate = htmlTemplate.replace('{{userFullName}}', user.firstName + ' ' + user.lastName);
    htmlTemplate = htmlTemplate.replace('{{userName}}', user.username);
    await sendMail({
      to: user.email,
      subject: 'CMMS application password changed successfully.',
      html: htmlTemplate
    });
    return res.status(200).json({ status: true, message: 'Password reset successful' });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const userLogOutService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // const { _id: user_id } = get(req, "user", {}) as IUser;
    // console.log('User ID:', user_id);
    // await UserToken.deleteMany({ userId: user_id });
    res.clearCookie('token');
    res.clearCookie('companyID');
    return res.status(200).json({ status: true, message: 'Logout successful' });
  } catch (error) {
    console.error(error);
    next(error);
  }
};