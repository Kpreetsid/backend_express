import { User, IUser } from "../../_models/user.model";
import { Request, Response, NextFunction } from 'express';
import { comparePassword } from '../../_config/bcrypt';
import { generateToken } from '../../_config/auth';

export const userAuthentication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    var { username, password } = req.body;
    const user = await User.findOne({ username });
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
      const error = new Error("User is not active");
      (error as any).status = 403;
      throw error;
    }
    var { password: userPassword, ...safeUser } = user.toObject();
    const userToken: any = {
      id: user._id,
      username: user.username,
      email: user.email,
      companyID: user.account_id
    }
    const token = generateToken(userToken);
    res.status(200).json({ status: true, message: 'Login successful', data: safeUser, token });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};