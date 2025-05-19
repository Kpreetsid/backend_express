import express, { Request, Response, NextFunction } from 'express';
import { getAll } from './asset.service';

export const getAssetsReport = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
};