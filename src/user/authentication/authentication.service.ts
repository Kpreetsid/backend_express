import { IUser, User, UserLoginPayload } from "../../_models/user.model";
import { Request, Response, NextFunction } from 'express';
import { comparePassword } from '../../_config/bcrypt';
import { generateAccessToken } from '../../_config/auth';

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
    res.cookie('token', token, { httpOnly: true, secure: true });
    res.cookie('user', JSON.stringify(safeUser), { httpOnly: true, secure: true });
    res.cookie('companyID', userTokenPayload.companyID, { httpOnly: true, secure: true });
    res.status(200).json({ status: true, message: 'Login successful', data: safeUser, token });
  } catch (error) {
    console.error(error);
    next(error);
  }
};