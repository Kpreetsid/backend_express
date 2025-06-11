import mongoose from "mongoose";
import { Account, IAccount } from "../../models/account.model";
import { NextFunction, Request, Response } from 'express';
import { getData } from "../../util/queryBuilder";
import { get } from "lodash";
import { IUser } from "../../models/user.model";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const match = { _id: account_id, isActive: true };
    const data = await getData(Account, { filter: match });
    if(data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
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
    const match = { _id: id, isActive: true };
    const data = await getData(Account, { filter: match });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getDataByParam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query;
    const match: any = { isActive: true };
    if(query.account_id) {
      match.account_id = query.account_id;
    }
    const data: IAccount[] = await getData(Account, { filter: match });
    if (data.length === 0) {
      throw Object.assign(new Error('No matching data found'), { status: 404 });
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
      throw Object.assign(new Error('No data found'), { status: 404 });
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
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await Account.findByIdAndUpdate(id, { isActive: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};