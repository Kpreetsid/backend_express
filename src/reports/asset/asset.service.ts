import { ReportAsset, IReportAsset } from "../../models/assetReport.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = req.user;
    const params = req.params;
    const match: any = { accountId: account_id };
    if(params?.id) {
      match.top_level_asset_id = params.id;
    }
    const data = await ReportAsset.find(match);
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);     
  }
};