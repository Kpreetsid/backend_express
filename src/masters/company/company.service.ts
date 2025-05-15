import mongoose from "mongoose";
import { Account, IAccount } from "../../_models/account.model";
import { NextFunction, Request, Response } from 'express';
import { sendMail } from "../../_config/mailer";

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

export const verifyCompany = async (id: string) => {
  try {
    const data: IAccount | null = await Account.findById(new mongoose.Types.ObjectId(id));
    if(!data || !data.isActive) {
      return null;
    }
    return data;
  } catch (error) {
    console.error(error);
    return null;
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
    if (!data || !data.isActive) {
      const error = new Error("Data not found");
      (error as any).status = 404;
      throw error;
    }
    await Account.findByIdAndUpdate(id, { isActive: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};