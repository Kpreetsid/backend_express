import mongoose, { ObjectId } from "mongoose";
import { Account, IAccount } from "../../models/account.model";
import { NextFunction, Request, Response } from 'express';
import { getData } from "../../util/queryBuilder";

export const getAllCompanies = async (filter: any) => {
  return await getData(Account, { filter });
};

export const createCompany = async (body: any) => {
  const match: any = { account_name: body.account_name };
  const existingCompany: IAccount[] = await Account.find(match);
  if (existingCompany.length > 0) {
    throw Object.assign(new Error('Company already exists'), { status: 403 });
  }
  const newCompany = new Account(body);
  return await newCompany.save();
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
    const { params: { id }, body } = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const data: IAccount | null = await Account.findByIdAndUpdate(id, body, { new: true });
    if (!data || !data.isActive) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const removeById = async (id: string, accountId: ObjectId, userId: any): Promise<boolean> => {
    const data: IAccount | null = await Account.findById(id);
    if (!data || !data.isActive) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await Account.findByIdAndUpdate(id, { isActive: false }, { new: true });
    return true;
};