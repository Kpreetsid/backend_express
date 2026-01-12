import { Request, Response, NextFunction } from 'express';
import { assetReportService } from './asset.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import mongoose from 'mongoose';

class AssetReportController {

  async getAssetsReport (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const match = { accountId: account_id };
      const populateFilter = [{ path: 'locationId', select: 'id location_name' }, { path: 'assetId', select: 'id asset_name' }, { path: 'userId', select: 'id firstName lastName' }];
      const data = await assetReportService.getAllAssetReports(match, populateFilter);
      if(!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
  async getAssetsReportById (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      if(!req.params.id) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      const match = { accountId: account_id, top_level_asset_id: req.params.id };
      const populateFilter = [{ path: 'locationId', model: "Schema_Location", select: 'id location_name' }, { path: 'assetId', model: "Schema_Asset", select: 'id asset_name' }, { path: 'userId', model: "Schema_User", select: 'id firstName lastName' }];
      const data = await assetReportService.getAllAssetReports(match, populateFilter);
      if(!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
  async getLatestReport (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      if(!req.params.id) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      const match: any = { accountId: account_id, top_level_asset_id: req.params.id };
      const selectedFields = `Observations Recommendations faultData`;
      const data = await assetReportService.getLatest(match, selectedFields);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
  async createAssetsReport (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { body: { workOrder, ...reportBody} } = req;
      const userToken = get(req, "userToken", {}) as string;
      const data = await assetReportService.createAssetReportWithWorkOrder(reportBody, user, userToken, reportBody.CreateWorkRequest, workOrder);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(201).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
  async updateAssetsReport (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      const userToken = get(req, "userToken", {}) as string;
      if(!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      body.updatedBy = user_id;
      const data = await assetReportService.updateAssetReport(String(id), body, account_id, user_id, userToken);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
  async deleteAssetsReport (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      if(!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      const match = { _id: id, accountId: account_id };
      const isDataExists = await assetReportService.getAllAssetReports(match);
      if (!isDataExists || isDataExists.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const data = await assetReportService.removeAssetReportById(String(id), user_id);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const assetReportController = new AssetReportController();