import { ReportAsset, IReportAsset } from "../../models/assetReport.model";
import { Request, Response, NextFunction } from 'express';
import { getData } from "../../util/queryBuilder";
import { get } from "lodash";
import { IUser } from "../../models/user.model";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const params = req.params;
    const match: any = { accountId: account_id };
    if(params?.id) {
      match.top_level_asset_id = params.id;
    }
    const data = await getData(ReportAsset, { filter: match, sort: { _id: -1 }, limit: 1 });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: data[0] });
  } catch (error) {
    next(error);     
  }
};