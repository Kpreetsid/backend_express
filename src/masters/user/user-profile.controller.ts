import { Request, Response, NextFunction } from 'express';
import { controllerCache } from '../../_cache/controllerCache.service';
import { UserModel } from '../../models/user.model';
import { profileRequestBody, profileError, profilePersistenceError, profilePhone, profilePrincipal, profileText } from '../profile.validation';

class UserProfileController {
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<any> {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const user = profilePrincipal(req);
      const body = profileRequestBody(req, ['firstName', 'lastName', 'phone_no']);
      const savedFields = {
        firstName: profileText(body.firstName, 'First name', 2, 100),
        lastName: profileText(body.lastName, 'Last name', 1, 100),
        phone_no: profilePhone(body.phone_no)
      };
      let saved;
      try {
        saved = await UserModel.findOneAndUpdate(
          { _id: user._id, account_id: user.account_id, user_status: 'active', visible: { $ne: false } },
          { $set: { ...savedFields, updatedBy: user._id } },
          { returnDocument: 'after', runValidators: true, timestamps: true,
            projection: { _id: 1, account_id: 1, firstName: 1, lastName: 1, phone_no: 1, updatedAt: 1 } }
        );
      } catch (error) { throw profilePersistenceError(error, 'user'); }
      if (!saved) throw profileError('User not found', 404);
      const phone = saved.phone_no as Record<string, string>;
      return res.json({ status: true, message: 'User profile updated successfully', data: {
        _id: saved._id, account_id: saved.account_id, firstName: saved.firstName, lastName: saved.lastName,
        updatedAt: saved.get('updatedAt'),
        phone_no: { number: phone.number, internationalNumber: phone.internationalNumber, nationalNumber: phone.nationalNumber,
          e164Number: phone.e164Number, countryCode: phone.countryCode, dialCode: phone.dialCode }
      } });
    } catch (error) { return next(error); }
  }
}

export const userProfileController = controllerCache.withCache(new UserProfileController(), {
  namespace: 'users', tags: ['users', 'roles', 'mappings']
});
