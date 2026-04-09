import { Request, Response, NextFunction } from 'express';
import { assetReportService } from './asset.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { processorAPIService } from '../../api-processor';
import { ASSET_REPORT_STATUS } from '../../models/assetReport.model';
import { observationService } from '../../masters/observation/observation.service';

class AssetReportController {
  private assetHealthArray: any = { 1: "Critical", 2: "Danger", 3: "Alert", 4: "Healthy", 5: "Not Defined" };

  getAssetsReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const match = { accountId: account_id, visible: true };
      const data = await assetReportService.getAllAssetReports(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Asset report not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  getAssetsReportById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const match: any = { accountId: account_id, visible: true };
      if (id) {
        match.top_level_asset_id = helperService.validateObjectId(String(id));
      }
      const data = await assetReportService.getAllAssetReports(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Asset report not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  getLatestReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const match: any = { accountId: account_id, top_level_asset_id: helperService.validateObjectId(String(id)) };
      const selectedFields = `Observations Recommendations faultData`;
      const data = await assetReportService.getLatest(match, selectedFields);
      if (!data) {
        throw Object.assign(new Error('Asset report not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  createAssetsReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    let assetReportId: any;
    try {
      const user = get(req, "user", {}) as IUser;
      const { body: { workOrder, ...reportBody } } = req;
      const userToken = get(req, "userToken", {}) as string;
      const data = await assetReportService.createAssetReportWithWorkOrder(reportBody, user, userToken, reportBody.CreateWorkRequest, workOrder);
      if (!data) {
        throw Object.assign(new Error('Asset report not created'), { status: 404 });
      }
      assetReportId = data?._id;
      if (reportBody.alarmId) {
        const payload = {
          alarm_id: reportBody.alarmId,
          report_id: data?._id,
          action_type: "created"
        }
        await processorAPIService.updateAlarmHistoryData(payload, user._id, userToken);
      }
      const payload: any = {
        asset_id: reportBody.assetId,
        health_created_from: 'report',
        asset_status: this.assetHealthArray[reportBody.EquipmentHealth],
        org_id: user.account_id
      };
      await processorAPIService.updateAssetHealthStatusOld(payload, userToken, user._id);
      res.status(201).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
      if (assetReportId) {
        await assetReportService.deleteAssetReport(helperService.validateObjectId(String(assetReportId)));
      }
      next(error);
    }
  };

  updateAssetsReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      const userToken = get(req, "userToken", {}) as string;
      body.updatedBy = user_id;
      const data = await assetReportService.updateAssetReport(helperService.validateObjectId(String(id)), body, account_id, user_id, userToken);
      if (!data) {
        throw Object.assign(new Error('Asset report not updated'), { status: 404 });
      }
      const payload: any = {
        asset_id: body.assetId,
        health_created_from: 'report',
        asset_status: this.assetHealthArray[body.EquipmentHealth],
        org_id: account_id
      };
      await processorAPIService.updateAssetHealthStatusOld(payload, userToken, user_id);
      res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
      next(error);
    }
  };

  partialUpdateAssetsReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      const userToken = get(req, "userToken", {}) as string;
      const isAssetReportExists: any = await assetReportService.getAllAssetReports({ _id: helperService.validateObjectId(String(id)), accountId: account_id, visible: true });
      if (!isAssetReportExists || isAssetReportExists.length === 0) {
        throw Object.assign(new Error('Asset report not found'), { status: 404 });
      }
      body.updatedBy = user_id;
      if (body.status === ASSET_REPORT_STATUS[3] && isAssetReportExists[0].status !== ASSET_REPORT_STATUS[3]) {
        body.chartDetail = isAssetReportExists[0].chartDetail.map((item: any) => ({ ...item, compare_time: Math.floor(Date.now() / 1000) }));
      }
      const data = await assetReportService.partialUpdateAssetReport(helperService.validateObjectId(String(id)), body, user_id, userToken);
      if (!data) {
        throw Object.assign(new Error('Asset report not updated'), { status: 404 });
      }
      if (body.status === ASSET_REPORT_STATUS[3] && isAssetReportExists[0].status !== ASSET_REPORT_STATUS[3]) {
        const topLevelAssetId = isAssetReportExists[0].top_level_asset_id;
        const getAllIncompleteReport: any = await assetReportService.getAllAssetReports({ top_level_asset_id: topLevelAssetId, status: { $ne: ASSET_REPORT_STATUS[3] }, visible: true, _id: { $ne: helperService.validateObjectId(String(id)) } });
        if (getAllIncompleteReport && getAllIncompleteReport.length === 0) {
          const payload = { asset_id: topLevelAssetId, freeze_score: false };
          await processorAPIService.assetHealthFreezeStatus(payload, user_id, userToken);
        }
      }
      res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
      next(error);
    }
  };

  deleteAssetsReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const userToken = get(req, "userToken", {}) as string;
      const { params: { id } } = req;
      const match = { _id: helperService.validateObjectId(String(id)), accountId: account_id, visible: true };
      const isDataExists = await assetReportService.getAllAssetReports(match);
      if (!isDataExists || isDataExists.length === 0) {
        throw Object.assign(new Error('Asset report not found'), { status: 404 });
      }
      if (isDataExists[0].status !== ASSET_REPORT_STATUS[3]) {
        const topLevelAssetId = isDataExists[0].top_level_asset_id;
        const getAllIncompleteReport: any = await assetReportService.getAllAssetReports({ top_level_asset_id: topLevelAssetId, status: { $ne: ASSET_REPORT_STATUS[3] }, visible: true });
        if (getAllIncompleteReport && getAllIncompleteReport.length === 1 && String(getAllIncompleteReport[0]._id) === String(id)) {
          const payload = { asset_id: topLevelAssetId, freeze_score: false };
          await processorAPIService.assetHealthFreezeStatus(payload, user_id, userToken);
        }
      }
      if (isDataExists[0].alarmId) {
        const payload = { alarm_id: isDataExists[0].alarmId, report_id: id, action_type: "delete" }
        await processorAPIService.updateAlarmHistoryData(payload, user_id, userToken);
      }
      await observationService.updateObservation({ report_id: helperService.validateObjectId(String(id)), accountId: account_id, visible: true }, { report_id: null, updatedBy: user_id });
      const data = await assetReportService.removeAssetReportById(helperService.validateObjectId(String(id)), user_id);
      if (!data) {
        throw Object.assign(new Error('Asset report not deleted'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const assetReportController = new AssetReportController();