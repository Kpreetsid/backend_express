import { Request, Response, NextFunction } from 'express';
import { userLocations, userAssets, mapUserLocations, updateMappedUserLocations, updateMappedUserFlags, createMapUserAssets } from './userLocation.service';

export const getUserLocations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await userLocations(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const getUserAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await userAssets(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const setUserAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const body = req.body;
    const assetIdList = body.map((doc: any) => doc.assetId);
    const userIdList = body.map((doc: any) => doc.userId);
    if(assetIdList.length !== userIdList.length) {
      throw Object.assign(new Error('Invalid data'), { status: 400 });
    }
    await createMapUserAssets(body);
    res.status(201).json({ message: 'Assets mapped successfully' });
  } catch (error) {
    next(error);
  }
};

export const setUserLocations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const body = req.body;
    const locationIdList = body.map((doc: any) => doc.locationId);
    const userIdList = body.map((doc: any) => doc.userId);
    if(locationIdList.length !== userIdList.length) {
      throw Object.assign(new Error('Invalid data'), { status: 400 });
    }
    await mapUserLocations(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const updateUserLocations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await updateMappedUserLocations(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const updateSendMailFlag = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await updateMappedUserFlags(req, res, next);
  } catch (error) {
    next(error);
  }
};