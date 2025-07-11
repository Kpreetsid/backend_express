import express, { Request, Response, NextFunction } from 'express';
import { getAll, getLatest, insertAssetReport, updateAssetReport, deleteAssetReport } from './asset.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';

export const getAssetsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match = { accountId: account_id };
    const populateFilter = [{ path: 'locationId', select: 'location_name' }, { path: 'assetId', select: 'asset_name' }, { path: 'userId', select: 'firstName lastName' }];
    const data = await getAll(match, populateFilter);
    if(!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error: any) {
    next(error);
  }
};

export const getAssetsReportById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match = { accountId: account_id, top_level_asset_id: req.params.id };
    const populateFilter = [{ path: 'locationId', select: 'location_name' }, { path: 'assetId', select: 'asset_name' }, { path: 'userId', select: 'firstName lastName' }];
    const data = await getAll(match, populateFilter);
    if(!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error: any) {
    next(error);
  }
};

export const getLatestReport = async (req: Request, res: Response, next: NextFunction) => {
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
  } catch (error: any) {
    next(error);
  }
};

export const createAssetsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const body = req.body;
    body.accountId = account_id;
    body.createdBy = user_id;
    const data = await insertAssetReport(body);
    res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error: any) {
    next(error);
  }
};

export const updateAssetsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { params: { id }, body } = req;
    if(!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    body.updatedBy = user_id;
    const data = await updateAssetReport(id, body);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error: any) {
    next(error);
  }
};

export const deleteAssetsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { params: { id } } = req;
    if(!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match = { _id: id, accountId: account_id };
    const isDataExists = await getAll(match);
    if (!isDataExists || isDataExists.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await deleteAssetReport(id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error: any) {
    next(error);
  }
};