import mongoose from "mongoose";
import { AccountModel, IAccount } from "../../models/account.model";

class CompanyService {

  async getAllCompanies (filter: any) {
    return await AccountModel.find(filter);
  };
  
  async createCompany (body: any) {
    const match: any = { account_name: body.account_name };
    const existingCompany: IAccount[] = await AccountModel.find(match);
    if (existingCompany.length > 0) {
      throw Object.assign(new Error('Company already exists'), { status: 403 });
    }
    const newCompany = new AccountModel({
      account_name: body.account_name,
      type: body.type,
      description: body.description
    });
    return await newCompany.save();
  };
  
  async verifyCompany (id: string) {
    try {
      const data: IAccount | null = await AccountModel.findById(new mongoose.Types.ObjectId(id));
      if(!data || !data.visible || data.account_status === 'inactive') {
        return null;
      }
      return data;
    } catch (error) {
      return null;
    }
  };
  
  async updateById (id: string, body: any) {
    return await AccountModel.findByIdAndUpdate(id, body, { new: true });
  };
  
  async removeById (id: string, userId: any): Promise<boolean> {
    const data: IAccount | null = await AccountModel.findById(id);
    if (!data || !data.visible || data.account_status === 'inactive') {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await AccountModel.findByIdAndUpdate(id, { visible: false, account_status: 'inactive', updated_by: userId }, { new: true });
    return true;
  };
}

export const companyService = new CompanyService();