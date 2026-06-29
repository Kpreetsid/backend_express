import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { reliabilityInsightsService } from './insights.service';

class ReliabilityInsightsController {
  getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await reliabilityInsightsService.getSummary(user as any, req.query as Record<string, unknown>);
      res.status(200).json({ status: true, message: 'Reliability insights fetched successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  getFailureLibrary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await reliabilityInsightsService.getFailureLibrary(user as any, req.query as Record<string, unknown>);
      res.status(200).json({ status: true, message: 'Reliability failure library fetched successfully.', data });
    } catch (error) {
      next(error);
    }
  };
}

export const reliabilityInsightsController = new ReliabilityInsightsController();
