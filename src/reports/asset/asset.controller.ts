import { Request, Response, NextFunction } from 'express';
import { getAllAssetReports, getLatest, updateAssetReport, removeAssetReportById, createAssetReportWithWorkOrder } from './asset.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';

export const getAssetsReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const match = { accountId: account_id };
    const populateFilter = [{ path: 'locationId', select: 'id location_name' }, { path: 'assetId', select: 'id asset_name' }, { path: 'userId', select: 'id firstName lastName' }];
    const data = await getAllAssetReports(match, populateFilter);
    if(!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getAssetsReportById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match = { accountId: account_id, top_level_asset_id: req.params.id };
    const populateFilter = [{ path: 'locationId', model: "Schema_Location", select: 'id location_name' }, { path: 'assetId', model: "Schema_Asset", select: 'id asset_name' }, { path: 'userId', model: "Schema_User", select: 'id firstName lastName' }];
    const data = await getAllAssetReports(match, populateFilter);
    if(!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getLatestReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { accountId: account_id, top_level_asset_id: req.params.id };
    if (userRole !== 'admin') {
      match.createdBy = user_id;
    }
    const selectedFields = `Observations Recommendations faultData`;
    const data = await getLatest(match, selectedFields);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const createAssetsReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const user = get(req, "user", {}) as IUser;
    const { body: { workOrder, ...reportBody} } = req;
    const token: any = req.cookies.token || req.headers.authorization;
    const data = await createAssetReportWithWorkOrder(reportBody, user, token, reportBody.CreateWorkRequest, workOrder);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updateAssetsReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id }, body } = req;
    const token: any = req.cookies.token || req.headers.authorization;
    if(!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    body.updatedBy = user_id;
    const data = await updateAssetReport(id, body, account_id, user_id, token);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const deleteAssetsReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id } } = req;
    if(!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match = { _id: id, accountId: account_id };
    const isDataExists = await getAllAssetReports(match);
    if (!isDataExists || isDataExists.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await removeAssetReportById(id, user_id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
};