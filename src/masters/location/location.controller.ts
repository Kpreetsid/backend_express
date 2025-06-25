import express, { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insertLocation, updateById, removeById, getTree, kpiFilterLocations, childAssetsAgainstLocation, updateFloorMapImage } from './location.service';

export const getLocations = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
}

export const getLocationTree = async (req: Request, res: Response, next: NextFunction) => {
  await getTree(req, res, next);
}

export const getKpiFilterLocations = async (req: Request, res: Response, next: NextFunction) => {
  await kpiFilterLocations(req, res, next);
}

export const getChildAssetsAgainstLocation = async (req: Request, res: Response, next: NextFunction) => {
  await childAssetsAgainstLocation(req, res, next);
}

export const getLocation = async (req: Request, res: Response, next: NextFunction) => {
  await getDataById(req, res, next);
}

export const createLocation = async (req: Request, res: Response, next: NextFunction) => {
  await insertLocation(req, res, next);
}

export const updateLocation = async (req: Request, res: Response, next: NextFunction) => {
  await updateById(req, res, next);
}

export const removeLocation = async (req: Request, res: Response, next: NextFunction) => {
  await removeById(req, res, next);
}

export const updateLocationFloorMapImage = async (req: Request, res: Response, next: NextFunction) => {
  await updateFloorMapImage(req, res, next);
}