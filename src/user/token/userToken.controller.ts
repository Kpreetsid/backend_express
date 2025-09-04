import { Request, Response, NextFunction } from 'express';
import { getAllUserTokens } from './userToken.service';

export const getUserByToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await getAllUserTokens(req, res, next);
};