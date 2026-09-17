import crypto from 'crypto';
import { helperService } from "../../utils/helper";
import { AccountModel, IAccount } from "../../models/account.model";
import { RoleManager } from "../../_role/accountRoleMenu";
import { AccountApiKeyModel } from "../../models/accountApiKey.model";

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
      description: body.description,
      cookie_status: body.cookie_status,
      encrypt_payload: body.encrypt_payload,
      encrypt_response: body.encrypt_response,
      account_role_menu: body.account_role_menu || RoleManager.getRoleMenu(body.experience_profile || 'standard_account'),
      account_permission_version: 1
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

  async removeById(id: any, userId: any): Promise<boolean> {
    const data: IAccount | null = await AccountModel.findById(id);
    if (!data || !data.visible || data.account_status === 'inactive') {
      throw Object.assign(new Error('No records found'), { status: 404 });
    }
    await AccountModel.findByIdAndUpdate(id, { visible: false, account_status: 'inactive', updated_by: userId }, { returnDocument: 'after' });
    return true;
  };

  async getAccountApiKey(accountId: string) {
    const companyId = helperService.validateObjectId(accountId);
    const account = await AccountModel.findById(companyId);
    if (!account) {
      throw Object.assign(new Error('Account not found'), { status: 404 });
    }

    const keyDoc = await AccountApiKeyModel.findOne({ account_id: companyId }).sort({ updatedAt: -1, createdAt: -1 });
    const key = keyDoc?.download_api_key || null;
    const isVisible = keyDoc ? Boolean(keyDoc.visible) : false;

    return {
      account_id: account._id,
      account_name: account.account_name,
      api_key: key,
      download_api_key: key,
      type: keyDoc?.type || 'download_api_key',
      visible: isVisible,
      is_active: isVisible,
      createdAt: keyDoc?.createdAt || null,
      updatedAt: keyDoc?.updatedAt || null
    };
  };

  async generateAccountApiKey(accountId: string) {
    const companyId = helperService.validateObjectId(accountId);
    const account = await AccountModel.findById(companyId);
    if (!account) {
      throw Object.assign(new Error('Account not found'), { status: 404 });
    }

    const newKey = crypto.randomBytes(36).toString('base64url');
    const keyDoc = await AccountApiKeyModel.findOneAndUpdate(
      { account_id: companyId },
      {
        $set: {
          download_api_key: newKey,
          type: 'download_api_key',
          visible: true
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return {
      account_id: account._id,
      account_name: account.account_name,
      api_key: newKey,
      download_api_key: newKey,
      type: keyDoc.type || 'download_api_key',
      visible: true,
      is_active: true,
      createdAt: keyDoc.createdAt,
      updatedAt: keyDoc.updatedAt
    };
  };

  async regenerateAccountApiKey(accountId: string) {
    return this.generateAccountApiKey(accountId);
  };

  async toggleAccountApiKeyStatus(accountId: string, visible?: boolean) {
    const companyId = helperService.validateObjectId(accountId);
    const account = await AccountModel.findById(companyId);
    if (!account) {
      throw Object.assign(new Error('Account not found'), { status: 404 });
    }

    const keyDoc = await AccountApiKeyModel.findOne({ account_id: companyId }).sort({ updatedAt: -1, createdAt: -1 });
    if (!keyDoc) {
      throw Object.assign(new Error('No API key found for this account'), { status: 404 });
    }

    const nextVisible = typeof visible === 'boolean' ? visible : !keyDoc.visible;
    keyDoc.visible = nextVisible;
    await keyDoc.save();

    return {
      account_id: account._id,
      account_name: account.account_name,
      api_key: keyDoc.download_api_key,
      download_api_key: keyDoc.download_api_key,
      type: keyDoc.type || 'download_api_key',
      visible: nextVisible,
      is_active: nextVisible,
      createdAt: keyDoc.createdAt,
      updatedAt: keyDoc.updatedAt
    };
  };
}

export const companyService = new CompanyService();
