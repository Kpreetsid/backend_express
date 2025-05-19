import express, { Request, Response, NextFunction } from 'express';
import { getAll } from './userLocation.service';

export const getUserLocations = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
};