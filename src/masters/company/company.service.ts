import { Account, IAccount } from "../../_models/account.model";
import { NextFunction, Request, Response } from 'express';

export const getAllAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: IAccount[] = await Account.find({ isActive: true }).sort({ _id: -1 });
    if(data.length === 0) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data: IAccount | null = await Account.findById(id);
    if (!data || !data.isActive) {
      const error = new Error("Data not found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data: IAccount | null = await Account.findByIdAndUpdate(id, req.body, { new: true });
    if (!data || !data.isActive) {
      const error = new Error("Data not found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data: IAccount | null = await Account.findById(id);
    if (!data) {
      const error = new Error("Data not found");
      (error as any).status = 404;
      throw error;
    }
    if (data?.isActive === false) {
      const error = new Error("Data already deleted");
      (error as any).status = 400;
      throw error;
    }
    await Account.findByIdAndUpdate(id, { isActive: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};