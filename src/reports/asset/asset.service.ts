import { ReportAsset, IReportAsset } from "../../_models/assetReport.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<IReportAsset[]> => {
  try {
    return await ReportAsset.find({}).sort({ _id: -1 });
  } catch (error) {
    next(error);
    throw error;     
  }
};