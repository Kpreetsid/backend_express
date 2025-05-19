import express, { Request, Response, NextFunction } from 'express';
import { getAll } from './location.service';

export const getLocationsReport = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
};