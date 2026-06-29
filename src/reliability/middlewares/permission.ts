import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';

export const hasReliabilityPermission = (action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const roleMenu = get(req, 'role', {}) as any;
      if (!user?.user_role) {
        throw Object.assign(new Error('Unauthorized access'), { status: 403 });
      }
      if (user.user_role === 'admin') {
        return next();
      }
      if (action === 'approve_recommendation' && user.user_role !== 'manager') {
        throw Object.assign(new Error('Only admin or manager users can approve reliability recommendations.'), { status: 403 });
      }
      if (roleMenu?.reliabilityCase?.[action]) {
        return next();
      }
      throw Object.assign(new Error('You do not have permission to access.'), { status: 403 });
    } catch (error) {
      next(error);
      return;
    }
  };
};
