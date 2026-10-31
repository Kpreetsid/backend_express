import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { cmmsDataService } from './cmms-data.service';

export async function getCmmsLocationData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await cmmsDataService.getData(req.body, get(req, 'user.account_id'));
    res.status(200).json({ status: true, message: 'Data fetched successfully', data });
  } catch (error) {
    next(error);
  }
}
