import mongoose from "mongoose";
import { Account, IAccount } from "../../models/account.model";

export const getAllCompanies = async (filter: any) => {
  return await Account.find(filter);
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
    return null;
  }
};

export const updateById = async (id: string, body: any) => {
  return await Account.findByIdAndUpdate(id, body, { new: true });
};

export const removeById = async (id: string, userId: any): Promise<boolean> => {
    const data: IAccount | null = await Account.findById(id);
    if (!data || !data.isActive) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await Account.findByIdAndUpdate(id, { isActive: false, updated_by: userId }, { new: true });
    return true;
};