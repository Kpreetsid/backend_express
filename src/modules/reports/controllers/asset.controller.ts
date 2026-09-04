import { PdfService } from '../services/asset-pdf.service';
import { storageConfig } from '../../../core/config/env.config';
import { controllerCache } from '../../../core/cache/controller-cache.service';

import { Request, Response, NextFunction } from 'express';
import { assetReportService } from '../services/asset.service';
import { get } from 'lodash';
import { IUser } from '../../users/models/user.model';
import { helperService } from '../../../common/utils/object-id.helper';
import { processorAPIService } from '../../assets/services/processor-api.service';
import { ASSET_REPORT_STATUS } from '../models/assetReport.model';
import { observationService } from '../../assets/services/observation.service';
import { applyRoleFilter } from '../../../common/utils/role-filter.helper';
import { AssetModel } from '../../assets/models/asset.model';
import {
  sanitizeAssetReportCreatePayload,
  sanitizeAssetReportStatusPayload,
  sanitizeAssetReportUpdatePayload
} from '../policies/asset.policy';

class AssetReportController {
  private pdfService = new PdfService();

  private parseJsonField<T>(value: any, fallback: T): T {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    if (typeof value !== 'string') {
      return value as T;
    }
    try {
      return JSON.parse(value) as T;
    } catch (_error) {
      throw Object.assign(new Error('Invalid PDF request payload'), { status: 400 });
    }
  }

  private getFrontendChartImages(req: Request): any[] {
    const files = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];
    const manifest = this.parseJsonField<any[]>(req.body?.chartManifest, []);

    if (!files.length && !manifest.length) {
      return [];
    }
    if (!Array.isArray(manifest) || manifest.length !== files.length) {
      throw Object.assign(new Error('Chart image manifest does not match uploaded files'), { status: 400 });
    }

    return files.map((file, index) => {
      const entry = manifest[index];
      const mimeType = file.mimetype || 'image/png';
      const base64Data = file.buffer.toString('base64');
      const dataUri = `data:${mimeType};base64,${base64Data}`;
      return {
        pointKey: entry?.pointKey,
        chartType: entry?.chartType,
        title: entry?.title,
        dataUri
      };
    });
  }

  private assetHealthArray: any = { 1: "Critical", 2: "Danger", 3: "Alert", 4: "Healthy", 5: "Not Defined" };

  getAssetsReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const match = await this.getReportScope(user);
      const data = await assetReportService.getAllAssetReports(match, user.account_id);
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  getAssetsReportById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const baseFilter: any = {};
      if (id) {
        baseFilter.top_level_asset_id = helperService.validateObjectId(String(id));
      }
      const match = await this.getReportScope(user, baseFilter);
      const data = await assetReportService.getAllAssetReports(match, user.account_id);
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  getLatestReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const match = await this.getReportScope(user, {
        top_level_asset_id: helperService.validateObjectId(String(id))
      });
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
      const reportPayload = sanitizeAssetReportCreatePayload(reportBody, user.account_id);
      await this.assertAssetAccess(user, reportPayload.assetId);
      await assetReportService.assertAssetReportReferences(reportPayload, user.account_id);
      const data = await assetReportService.createAssetReportWithWorkOrder(reportPayload as any, user, userToken, reportPayload.CreateWorkRequest, workOrder);
      if (!data) {
        throw Object.assign(new Error('Asset report not created'), { status: 404 });
      }
      assetReportId = data?._id;
      if (reportPayload.alarmId) {
        const payload = {
          alarm_id: data.alarmId,
          report_id: data?._id,
          action_type: "created"
        }
        await processorAPIService.updateAlarmHistoryData(payload, user._id, userToken);
      }
      const healthPayload: any = {
        asset_id: data.assetId,
        health_created_from: 'report',
        asset_status: this.assetHealthArray[data.EquipmentHealth],
        org_id: user.account_id
      };
      await processorAPIService.updateAssetHealthStatusOld(healthPayload, userToken, user._id);
      res.status(201).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
      if (assetReportId) {
        const user = get(req, "user", {}) as IUser;
        await assetReportService.rollbackCreatedAssetReport(
          helperService.validateObjectId(String(assetReportId)),
          user
        ).catch((rollbackError: any) => console.error('Failed to roll back asset report creation:', rollbackError));
      }
      next(error);
    }
  };

  updateAssetsReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      const userToken = get(req, "userToken", {}) as string;
      const reportId = helperService.validateObjectId(String(id));
      const existing = await assetReportService.getAssetReportRecord(await this.getReportScope(
        get(req, "user", {}) as IUser,
        { _id: reportId }
      ));
      if (!existing) throw Object.assign(new Error('Asset report not found'), { status: 404 });
      const payload = sanitizeAssetReportUpdatePayload(body, existing.files, account_id);
      const data = await assetReportService.updateAssetReport(reportId, payload, account_id, user_id, userToken);
      if (!data) {
        throw Object.assign(new Error('Asset report not updated'), { status: 404 });
      }
      if (payload.EquipmentHealth !== undefined) {
        await processorAPIService.updateAssetHealthStatusOld({
          asset_id: existing.assetId,
          health_created_from: 'report',
          asset_status: this.assetHealthArray[payload.EquipmentHealth],
          org_id: account_id
        }, userToken, user_id);
      }
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
      const reportId = helperService.validateObjectId(String(id));
      const existing = await assetReportService.getAssetReportRecord(await this.getReportScope(
        get(req, "user", {}) as IUser,
        { _id: reportId }
      ));
      if (!existing) {
        throw Object.assign(new Error('Asset report not found'), { status: 404 });
      }
      const payload: any = sanitizeAssetReportStatusPayload(body);
      if (payload.observationId) {
        await assetReportService.assertReportObservation(reportId, payload.observationId, account_id);
      }
      const isCompleting = payload.status === ASSET_REPORT_STATUS[3] && existing.status !== ASSET_REPORT_STATUS[3];
      if (isCompleting) {
        payload.chartDetail = (Array.isArray(existing.chartDetail) ? existing.chartDetail : [])
          .map((item: any) => ({ ...item, compare_time: Math.floor(Date.now() / 1000) }));
      }
      const data = await assetReportService.partialUpdateAssetReport(
        reportId,
        account_id,
        existing.status,
        payload,
        user_id,
        userToken
      );
      if (!data) {
        throw Object.assign(new Error('Asset report status changed during this request; refresh and try again'), { status: 409 });
      }
      if (isCompleting) {
        const topLevelAssetId = existing.top_level_asset_id;
        const getAllIncompleteReport: any = await assetReportService.getAllAssetReports({
          accountId: account_id,
          top_level_asset_id: topLevelAssetId,
          status: { $ne: ASSET_REPORT_STATUS[3] },
          visible: true,
          _id: { $ne: reportId }
        }, account_id);
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
      const reportId = helperService.validateObjectId(String(id));
      const existing = await assetReportService.getAssetReportRecord(await this.getReportScope(
        get(req, "user", {}) as IUser,
        { _id: reportId }
      ));
      if (!existing) {
        throw Object.assign(new Error('Asset report not found'), { status: 404 });
      }
      if (existing.status !== ASSET_REPORT_STATUS[3]) {
        const topLevelAssetId = existing.top_level_asset_id;
        const getAllIncompleteReport: any = await assetReportService.getAllAssetReports({
          accountId: account_id,
          top_level_asset_id: topLevelAssetId,
          status: { $ne: ASSET_REPORT_STATUS[3] },
          visible: true
        }, account_id);
        if (getAllIncompleteReport && getAllIncompleteReport.length === 1 && String(getAllIncompleteReport[0]._id) === String(id)) {
          const payload = { asset_id: topLevelAssetId, freeze_score: false };
          await processorAPIService.assetHealthFreezeStatus(payload, user_id, userToken);
        }
      }
      if (existing.alarmId) {
        const payload = { alarm_id: existing.alarmId, report_id: id, action_type: "delete" }
        await processorAPIService.updateAlarmHistoryData(payload, user_id, userToken);
      }
      await observationService.updateObservation({ report_id: reportId, accountId: account_id, visible: true }, { report_id: null, updatedBy: user_id });
      const data = await assetReportService.removeAssetReportById(reportId, account_id, user_id);
      if (!data) {
        throw Object.assign(new Error('Asset report not deleted'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {

      next(error);
    }
  };  generateAssetReportPdf = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { params: { id } } = req;
      const body = req.is('multipart/form-data')
        ? this.parseJsonField<any>(req.body?.payload, {})
        : (req.body || {});
      const frontendChartImages = this.getFrontendChartImages(req);
      const reportId = helperService.validateObjectId(String(id));
      const reports: any[] = await assetReportService.getAllAssetReports({ _id: reportId, visible: true });

      if (!reports || reports.length === 0) {
        throw Object.assign(new Error('Asset report not found'), { status: 404 });
      }

      const report = reports[0];

      const {
        labels,
        timezone,
        locale,
        assetCondition,
        faultData,
        chartOptions,
        chartStates
      } = body || {};

      const payload: any = {
        labels: labels || {},
        timezone,
        locale: locale || labels?.locale,
        assetCondition,
        faultData: faultData || [],
        chartOptions: chartOptions || {},
        chartStates: chartStates || {},
        assetName: report.assetId?.asset_name || report.assetName || 'NA',
        assetImage: report.assetId?.image_path || report.assetImage || null,
        analysisDate: report.createdOn,
        location: report.locationId?.location_name || report.locationName || 'NA',
        sensorsMapped: report.endpointRMSData?.length || 0,
        conditionClass: report.EquipmentHealth,
        observations: report.Observations && report.Observations.trim() ? report.Observations : null,
        recommendations: report.Recommendations && report.Recommendations.trim() ? report.Recommendations : null,
        iso: report.ISO,
        healthHistory: report.asset_health_history || [],
        createdFrom: report.createdFrom || 'Asset Report',
        chartDetail: report.chartDetail || [],
        harmonicIndex: report.harmonicIndex || [],
        frontendChartImages,
        readings: (report.endpointRMSData || []).map((point: any) => {
          const getTimestamp = (src: any) =>
            src?.Axial?.timestamp || src?.Horizontal?.timestamp || src?.Vertical?.timestamp;
          return {
            point: `${point.asset_name} > ${point.point_name}-${point.mount_location}`,
            compositeId: point.composite_id || '',
            timestamp: getTimestamp(point?.acceleration) || getTimestamp(point?.velocity) || null,
            acceleration: {
              h: point?.acceleration?.Horizontal?.rms ?? '-',
              v: point?.acceleration?.Vertical?.rms ?? '-',
              a: point?.acceleration?.Axial?.rms ?? '-'
            },
            velocity: {
              h: point?.velocity?.Horizontal?.rms ?? '-',
              v: point?.velocity?.Vertical?.rms ?? '-',
              a: point?.velocity?.Axial?.rms ?? '-'
            }
          };
        }),
        attachments: (report.files || []).map((img: any) =>
          img.folderName ? `${storageConfig.baseUrl}/${img.folderName}/${img.fileName}` : `${storageConfig.baseUrl}/${img.fileName}`
        )
      };

      if (!payload.assetImage && report.assetId?.image_path) {
        payload.assetImage = `${storageConfig.baseUrl}/${report.assetId.image_path}`;
      }

      const user = get(req, "user", {}) as IUser;
      const userToken = get(req, "userToken", "") as string;
      const pdfBuffer = await this.pdfService.generateAssetReportPdf(payload, userToken, String(user._id));
      const assetName = payload.assetName || 'Asset';
      const cleanName = assetName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Asset_Report_${cleanName}_${dateStr}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };

  private getReportScope = async (user: IUser, baseFilter: Record<string, any> = {}): Promise<Record<string, any>> => {
    return await applyRoleFilter({
      user,
      baseFilter,
      accountField: 'accountId',
      mapping: 'asset',
      idField: 'assetId'
    });
  };

  private assertAssetAccess = async (user: IUser, assetId: string): Promise<void> => {
    const filter = await applyRoleFilter({
      user,
      baseFilter: { _id: helperService.validateObjectId(assetId) },
      accountField: 'account_id',
      mapping: 'asset',
      idField: '_id'
    });
    if (!await AssetModel.exists(filter)) {
      throw Object.assign(new Error('Asset report target was not found'), { status: 404 });
    }
  };
}

export const assetReportController = controllerCache.withCache(new AssetReportController(), { namespace: 'reports', ttlSeconds: 60, tags: ['reports', 'assets', 'locations', 'work-orders'] });

