import { Request, Response, NextFunction } from 'express';
import { userLocations, userAssets, mapUserLocations, updateMappedUserLocations, updateMappedUserFlags, createMapUserAssets, updateMapUserAssets, checkDuplicateAssetMapping } from './userLocation.service';

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
    const duplicateAssetMapping: any = checkDuplicateAssetMapping(body);
    if(duplicateAssetMapping.length === 0) {
      throw Object.assign(new Error('Mapping already exists'), { status: 400 });
    }
    await createMapUserAssets(duplicateAssetMapping);
    res.status(201).json({ message: 'Assets mapped successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateUserAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { params: { assetId }, body } = req;
    if (!assetId || body.length === 0) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const data = await updateMapUserAssets(assetId, body);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(201).json({ status: true, message: 'Assets mapped successfully' });
  } catch (error) {
    next(error);
  }
}

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