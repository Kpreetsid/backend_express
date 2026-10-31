import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { supportLogin } from '@core/config/env.config';

export const isValidSupportServiceKey = (provided: string | undefined, expected: string | undefined): boolean => {
  const left = Buffer.from(String(provided || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
};

export const requireSupportLoginService = (req: Request, _res: Response, next: NextFunction): void => {
  const provided = String(req.headers['x-support-login-key'] || '');
  if (!isValidSupportServiceKey(provided, supportLogin.serviceKey)) {
    next(Object.assign(new Error('Unauthorized support login issuer'), { status: 401 }));
    return;
  }
  next();
};
