import { Request, Response, NextFunction } from 'express';
import { controllerCache } from '../../_cache/controllerCache.service';
import { AccountModel } from '../../models/account.model';
import { profileRequestBody, profileError, profilePersistenceError, profilePrincipal, profileText } from '../profile.validation';

class CompanyProfileController {
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<any> {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const user = profilePrincipal(req);
      if (user.user_role !== 'admin') throw profileError('Forbidden', 403);
      const body = profileRequestBody(req, ['account_name', 'description']);
      const savedFields: { account_name: string; description?: string } = {
        account_name: profileText(body.account_name, 'Account name', 2, 150)
      };
      if (Object.prototype.hasOwnProperty.call(body, 'description')) {
        savedFields.description = profileText(body.description, 'Description', 0, 2000);
      }
      let saved;
      try {
        saved = await AccountModel.findOneAndUpdate(
          { _id: user.account_id, visible: { $ne: false }, account_status: { $ne: 'inactive' } },
          { $set: savedFields },
          { returnDocument: 'after', runValidators: true, timestamps: true,
            projection: { _id: 1, account_name: 1, description: 1, updatedAt: 1 } }
        );
      } catch (error) { throw profilePersistenceError(error, 'account'); }
      if (!saved) throw profileError('Account not found', 404);
      return res.json({ status: true, message: 'Account profile updated successfully', data: {
        _id: saved._id, account_name: saved.account_name, description: saved.description ?? '', updatedAt: saved.get('updatedAt')
      } });
    } catch (error) { return next(error); }
  }
}

export const companyProfileController = controllerCache.withCache(new CompanyProfileController(), {
  namespace: 'companies', tags: ['companies', 'settings', 'users']
});
