import { IUser, User, UserLoginPayload } from "../../_models/user.model";
import { Request, Response, NextFunction } from 'express';
import { comparePassword } from '../../_config/bcrypt';
import { generateAccessToken, generateRefreshToken, verifyAndRefreshToken } from '../../_config/auth';

export const userAuthentication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    const user: IUser | null = await User.findOne({ username });
    if (!user) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      const error = new Error("Invalid credentials");
      (error as any).status = 401;
      throw error;
    } 
    if (user.user_status !== 'active') {
      const error = new Error("Inactivated user");
      (error as any).status = 403;
      throw error;
    } 
    const { password: _, ...safeUser } = user.toObject();
    const userTokenPayload: UserLoginPayload = { id: `${user._id}`, username: user.username, email: user.email, companyID: `${user.account_id}` };
    const token = generateAccessToken(userTokenPayload);
    const refreshToken = generateRefreshToken(userTokenPayload);

    res.status(200).json({ status: true, message: 'Login successful', data: safeUser, token, refreshToken });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const refreshUserAuthentication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      const error = new Error("Refresh token required");
      (error as any).status = 401;
      throw error;
    }
    const newToken = verifyAndRefreshToken(refreshToken, res);
    if (!newToken) {
      const error = new Error("Refresh token expired or invalid");
      (error as any).status = 401;
      throw error;
    }
    res.status(200).json({ status: true, message: "Token refreshed successfully", token: newToken });
  } catch (error) {
    console.error(error);
    next(error);
  }
};