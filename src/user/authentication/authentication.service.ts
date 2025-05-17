import { IUser, User, UserLoginPayload } from "../../models/user.model";
import { Request, Response, NextFunction } from 'express';
import { comparePassword } from '../../_config/bcrypt';
import { generateAccessToken } from '../../_config/auth';
import { UserToken } from "../../models/userToken.model";
import { verifyUserRole } from "../../masters/user/role/role.service";

export const userAuthentication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    const user: IUser | null = await User.findOne({ username }).select('+password');
    if (!user || user.user_status !== 'active') {
      throw Object.assign(new Error('No data found'), { status: 404 });
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
    res.cookie('token', token, { httpOnly: true, secure: true });
    res.cookie('companyID', userTokenPayload.companyID, { httpOnly: true, secure: true });
    const userTokenData = new UserToken({
      _id: token,
      userId: user._id,
      principalType: 'user',
      ttl: 24 * 60 * 60
    });
    await userTokenData.save();
    res.status(200).json({ status: true, message: 'Login successful', data: {userDetails: safeUser, token, platformControl: userRoleData.data} });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const userLogOutService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.clearCookie('token');
    res.clearCookie('companyID');
    return res.status(200).json({ status: true, message: 'Logout successful' });
  } catch (error) {
    console.error(error);
    next(error);
  }
};