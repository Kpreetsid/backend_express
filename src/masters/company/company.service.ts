import { helperService } from "../../utils/helper";
import { AccountModel, IAccount } from "../../models/account.model";

class CompanyService {

  async getAllCompanies(filter: any) {
    return await AccountModel.find(filter);
  };

  async createCompany(body: any, session?: any) {
    const match: any = { account_name: body.account_name };
    const existingCompany: IAccount[] = await AccountModel.find(match).session(session || null);
    if (existingCompany.length > 0) {
      throw Object.assign(new Error('Company already exists'), { status: 403 });
    }
    const newCompany = new AccountModel({
      account_name: body.account_name,
      type: body.type,
      experience_profile: body.experience_profile || 'standard_account',
      description: body.description
    });
    return await newCompany.save({ session });
  };

  async verifyCompany(id: string) {
    try {
      const companyId = helperService.validateObjectId(id);
      const data: IAccount | null = await AccountModel.findById(companyId);
      if (!data || !data.visible || data.account_status === 'inactive') {
        return null;
      }
      return data;
    } catch (error) {
      return null;
    }
  };

  async updateById(id: any, body: any) {
    return await AccountModel.findByIdAndUpdate(id, body, { returnDocument: 'after' });
  };

  async removeById(id: any, userId: any, accountId: any): Promise<boolean> {
    if (String(id) !== String(accountId)) {
      throw Object.assign(new Error('Invalid account ID'), { status: 400 });
    }
    const match = { _id: id, visible: true, account_status: { $ne: 'inactive' } };
    const data: IAccount | null = await AccountModel.findOne(match);
    if (!data || !data.visible || data.account_status === 'inactive') {
      throw Object.assign(new Error('No records found'), { status: 404 });
    }
    await AccountModel.findOneAndUpdate(
      match,
      { visible: false, account_status: 'inactive', updated_by: userId },
      { returnDocument: 'after' }
    );
    return true;
  };
}

export const companyService = new CompanyService();
