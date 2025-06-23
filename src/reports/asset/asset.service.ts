import { ReportAsset, IReportAsset } from "../../models/assetReport.model";
import { Request, Response, NextFunction } from 'express';
import { getData } from "../../util/queryBuilder";
import { get } from "lodash";
import { IUser } from "../../models/user.model";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { id, data_type } = req.params;
    const match: any = { accountId: account_id };
    if (userRole !== 'admin') {
      match.user_id = user_id;
    }
    if (data_type) {
      match.data_type = data_type;
    }
    if (id) {
      match.top_level_asset_id = id;
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

export const getLatest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    if(!id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { accountId: account_id, top_level_asset_id: id };
    if (userRole !== 'admin') {
      match.user_id = user_id;
    }
    const data = await getData(ReportAsset, { filter: match, select: 'Observations Recommendations faultData', sort: { _id: -1 }, limit: 1 });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: data[0] });
  } catch (error) {
    next(error);
  }
};