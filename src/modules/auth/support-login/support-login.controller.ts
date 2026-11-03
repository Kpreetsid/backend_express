import { Request, Response, NextFunction } from 'express';
import { issueSupportLoginToken, supportServiceAuthorized } from './support-login.service';

export const issueSupportLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!supportServiceAuthorized(req.headers['x-internal-service-key'])) {
      throw Object.assign(new Error('Unauthorized service'), { status: 401 });
    }
    const data = await issueSupportLoginToken(req.body);
    res.json({ status: true, data });
  } catch (error) {
    next(error);
  }
};
