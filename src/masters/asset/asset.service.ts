import { Asset, IAsset } from "../../_models/asset.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<IAsset[]> => {
  try {
    return await Asset.find({}).sort({ _id: -1 });
  } catch (error) {
    next(error);
    throw error;     
  }
};