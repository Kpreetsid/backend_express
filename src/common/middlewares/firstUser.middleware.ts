import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';

export const requireFirstUser = (req: Request, res: Response, next: NextFunction): void => {
  const user: any = get(req, 'user', {});
  const isFirstUser = Boolean(user?.isFirstUser);

  if (!isFirstUser) {
    res.status(403).json({
      status: false,
      code: 'FIRST_USER_REQUIRED',
      message: 'Access denied: Only the account first user (Super Admin) is authorized to manage API keys.'
    });
    return;
  }

  next();
};
