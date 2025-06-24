import express, { Request, Response, NextFunction } from 'express';
import { userLocations, userAssets, mapUserLocations, updateMappedUserLocations } from './userLocation.service';

export const getUserLocations = async (req: Request, res: Response, next: NextFunction) => {
  await userLocations(req, res, next);
};

export const getUserAssets = async (req: Request, res: Response, next: NextFunction) => {
  await userAssets(req, res, next);
};

export const setUserLocations = async (req: Request, res: Response, next: NextFunction) => {
  await mapUserLocations(req, res, next);
};

export const updateUserLocations = async (req: Request, res: Response, next: NextFunction) => {
  await updateMappedUserLocations(req, res, next);
};