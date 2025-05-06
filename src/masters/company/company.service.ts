import { Account, IAccount } from "../../_models/account.model";
import { NextFunction, Request, Response } from 'express';

export const getAllAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await Account.find({}).sort({ _id: -1 });
    if(data.length === 0) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};