import { UserToken, IUserToken } from "../../_models/userToken.model";
import { Request, Response, NextFunction } from 'express';

export const getAllUserTokens = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = req.user;
    const data = await UserToken.find({account_id: account_id}).sort({ _id: -1 });
    if (data.length === 0) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);     
  }
};

export const createUserToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, token } = req.body;
    const userToken = new UserToken({ userId, token });
    await userToken.save();
    return res.status(201).json({ status: true, message: "Data inserted successfully", data: userToken });
  } catch (error) {
    next(error);     
  }
}