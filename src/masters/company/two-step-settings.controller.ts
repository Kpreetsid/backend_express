import { Request, Response, NextFunction } from 'express';
import { AccountModel } from '../../models/account.model';
import { IUser } from '../../models/user.model';
import { get } from 'lodash';

function admin(req: Request): IUser {
  const user = get(req, 'user') as IUser | undefined;
  if (!user?._id || !user.account_id) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  if (user.user_role !== 'admin') throw Object.assign(new Error('Forbidden'), { status: 403 });
  return user;
}

export async function getTwoStepSettings(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const user = admin(req);
    const account = await AccountModel.findOne({ _id: user.account_id, visible: { $ne: false } });
    if (!account) throw Object.assign(new Error('Account unavailable'), { status: 404 });
    return res.json({ status: true, data: { enabled: account.two_step_auth_enabled === true } });
  } catch (error) { return next(error); }
}

export async function updateTwoStepSettings(req: Request, res: Response, next: NextFunction): Promise<any> {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const user = admin(req);
    const body = req.body;
    if (!body || typeof body.enabled !== 'boolean' || Object.keys(body).some(key => key !== 'enabled')) {
      throw Object.assign(new Error('A boolean enabled setting is required'), { status: 400 });
    }
    if (body.enabled && Buffer.byteLength(process.env.TWO_STEP_AUTH_SECRET || '', 'utf8') < 32) {
      throw Object.assign(new Error('Two-step authentication is unavailable. Please contact support.'), { status: 503 });
    }
    const scope = { _id: user.account_id, visible: { $ne: false }, account_status: { $ne: 'inactive' } };
    // A policy revision changes only when the flag changes; concurrent requests
    // cannot preserve a stale revision or overwrite another tenant's policy.
    let account = await AccountModel.findOneAndUpdate({ ...scope, two_step_auth_enabled: { $ne: body.enabled } }, {
      $set: { two_step_auth_enabled: body.enabled, two_step_auth_updated_by: user._id, two_step_auth_updated_at: new Date() },
      $inc: { two_step_auth_revision: 1 }
    }, { returnDocument: 'after' });
    if (!account) account = await AccountModel.findOne(scope);
    if (!account) throw Object.assign(new Error('Account unavailable'), { status: 404 });
    return res.json({ status: true, message: 'Account security setting updated', data: { enabled: account.two_step_auth_enabled === true } });
  } catch (error) { return next(error); }
}
