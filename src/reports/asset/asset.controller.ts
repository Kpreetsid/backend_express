import { Request, Response, NextFunction } from 'express';
import { getAll, getLatest, insertAssetReport, updateAssetReport, deleteAssetReport, removeAssetReportById } from './asset.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { getExternalData } from '../../util/externalAPI';

export const getAssetsReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const match = { accountId: account_id };
    const populateFilter = [{ path: 'locationId', select: 'id location_name' }, { path: 'assetId', select: 'id asset_name' }, { path: 'userId', select: 'id firstName lastName' }];
    const data = await getAll(match, populateFilter);
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
    const data = await getAll(match, populateFilter);
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
  var data: any;
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { body } = req;
    const token: any = req.cookies.token || req.headers.authorization;
    data = await insertAssetReport(body, account_id, user_id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await setAssetHealthStatus(body, account_id, user_id, token);
    res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    if (data) {
      await deleteAssetReport(data._id);
    }
    next(error);
  }
};

export const setAssetHealthStatus = async (body: any, account_id: any, user_id: any, token: any) => {
  const apiPath = `/asset_health_status/`;
  const payload: any = { "asset_id": body.assetId, "asset_status": body.assetHealth, "org_id": account_id };
  await getExternalData(apiPath, 'POST', payload, token, user_id);
}

export const updateAssetsReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { params: { id }, body } = req;
    if(!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const { _id: user_id } = get(req, "user", {}) as IUser;
    body.updatedBy = user_id;
    const data = await updateAssetReport(id, body);
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
    const isDataExists = await getAll(match);
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