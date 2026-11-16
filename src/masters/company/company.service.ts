import { emailLoginService } from '../../user/email-login/email-login.service';
import crypto from 'crypto';
import { helperService } from "../../utils/helper";
import { AccountModel, IAccount, SensorUptimeEmailRecipientsModel, SensorRecipientUserDetail } from "../../models/account.model";
import { RoleManager } from "../../_role/accountRoleMenu";
import { AccountApiKeyModel } from "../../models/accountApiKey.model";

import { UserModel } from '../../models/user.model';

const sensorEmailAccountScope = (accountId: string) => ({
  _id: accountId, visible: { $ne: false }, account_status: { $ne: 'inactive' }
});

class CompanyService {
  async getSensorUptimeEmails(accountId: string): Promise<SensorRecipientUserDetail[]> {
    const account = await AccountModel.findOne(sensorEmailAccountScope(accountId)).select({ sensor_uptime_email_mapping: 1 });
    if (!account) throw Object.assign(new Error('Account not found'), { status: 404 });
    if (!account.sensor_uptime_email_mapping) return [];
    const recipients = await SensorUptimeEmailRecipientsModel.findOne({
      _id: account.sensor_uptime_email_mapping, account_id: account._id
    }).select({ usersDetail: 1 });
    if (!recipients) throw Object.assign(new Error('Email recipient mapping not found'), { status: 404 });
    return recipients.usersDetail;
  };

  async updateSensorUptimeEmails(accountId: string, usersDetail: { user_id: string }[]): Promise<SensorRecipientUserDetail[]> {
    const scope = sensorEmailAccountScope(accountId);
    const account = await AccountModel.findOne(scope).select({ _id: 1 });
    if (!account) throw Object.assign(new Error('Account not found'), { status: 404 });
    const userIds = [...new Set(usersDetail.map(user => user.user_id))];
    const users = userIds.length ? await UserModel.find({
      _id: { $in: userIds }, account_id: account._id
    }).select({ _id: 1, firstName: 1, lastName: 1, email: 1, user_role: 1 }) : [];
    const byId = new Map(users.map(user => [String(user._id), user]));
    if (userIds.some(id => !byId.has(id))) {
      throw Object.assign(new Error('One or more selected users do not belong to this account or are unavailable'), { status: 400 });
    }
    const canonicalUsers = userIds.map(id => {
      const user = byId.get(id)!;
      if (!user.email?.trim()) throw Object.assign(new Error('Selected users must have an email address'), { status: 400 });
      return {
        user_id: user._id, firstName: user.firstName || '', lastName: user.lastName || '',
        email: user.email.trim().toLowerCase(), user_role: user.user_role || ''
      };
    });
    // Create an empty document first. A failed link never changes saved details;
    // the deterministic ID lets a later retry reuse an unlinked document.
    const recipients = await SensorUptimeEmailRecipientsModel.findOneAndUpdate(
      { _id: account._id },
      { $setOnInsert: { account_id: account._id, usersDetail: [] } },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
    if (!recipients || String(recipients.account_id) !== String(account._id)) {
      throw Object.assign(new Error('Email recipient mapping not found'), { status: 404 });
    }
    const linked = await AccountModel.findOneAndUpdate(scope,
      { $set: { sensor_uptime_email_mapping: recipients._id } },
      { returnDocument: 'after', runValidators: true, projection: { _id: 1 } });
    if (!linked) throw Object.assign(new Error('Account not found'), { status: 404 });
    const saved = await SensorUptimeEmailRecipientsModel.findOneAndUpdate(
      { _id: recipients._id, account_id: account._id },
      { $set: { usersDetail: canonicalUsers } },
      { returnDocument: 'after', runValidators: true, projection: { usersDetail: 1 } }
    );
    if (!saved) throw Object.assign(new Error('Email recipient mapping not found'), { status: 404 });
    return saved.usersDetail;
  }

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
    if (body.account_status === 'inactive' || (body as any).visible === false) await emailLoginService.revokeAccount(String(id), 'system', 'account-disabled');
    return await AccountModel.findByIdAndUpdate(id, body, { returnDocument: 'after' });
  };

  async removeById(id: any, userId: any): Promise<boolean> {
    const data: IAccount | null = await AccountModel.findById(id);
    if (!data || !data.visible || data.account_status === 'inactive') {
      throw Object.assign(new Error('No records found'), { status: 404 });
    }
    await emailLoginService.revokeAccount(String(id), String(userId), 'account-disabled');
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
