import express, { Request, Response, NextFunction } from 'express';
import { getAll, getLatest } from './asset.service';

export const getAssetsReport = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
};

export const getLatestReport = async (req: Request, res: Response, next: NextFunction) => {
  await getLatest(req, res, next);
};