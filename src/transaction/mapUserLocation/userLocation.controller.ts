import express, { Request, Response, NextFunction } from 'express';
import { userLocations, userAssets } from './userLocation.service';

export const getUserLocations = async (req: Request, res: Response, next: NextFunction) => {
  await userLocations(req, res, next);
};

export const getUserAssets = async (req: Request, res: Response, next: NextFunction) => {
  await userAssets(req, res, next);
};