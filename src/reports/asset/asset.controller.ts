import { applicationLogger } from '../../observability/logger';
import { Request, Response, NextFunction } from 'express';
import { assetReportService } from './asset.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { ASSET_REPORT_STATUS } from '../../models/assetReport.model';
import { observationService } from '../../masters/observation/observation.service';
import { PdfService } from './asset-pdf.service';
import { externalAPI } from '../../configDB';
import { withTransaction } from '../../utils/transaction.helper';
import { queueAssetReportProcessorSync } from '../../queue/processor-events';
import {
  synchronizeAssetReportProcessor
} from '../../queue/handlers/asset-report-processor.handler';
import { randomUUID } from 'node:crypto';
import { assetReportPdfJobService } from './asset-pdf-job.service';
import {
  buildAssetReportPdfPayload,
  createInlineChartImages,
  parsePdfJsonField,
  selectPdfRequestPayload
} from './asset-pdf-request';

class AssetReportController {
  private pdfService = new PdfService();

  private requirePdfJobId(value: unknown): string {
    const jobId = String(value || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
      throw Object.assign(new Error('Invalid PDF generation job identifier'), { status: 400 });
    }
    return jobId;
  }

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
      const match: any = { accountId: account_id, top_level_asset_id: helperService.validateObjectId(String(id)), visible: true };
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
    try {
      const user = get(req, "user", {}) as IUser;
      const { body: { workOrder, ...reportBody } } = req;
      const correlationId = String(res.locals['correlationId'] || randomUUID());
      let data: any;
      const processorQueued = await withTransaction(async (session) => {
        await assetReportService.requireTenantReferences(
          reportBody,
          user.account_id,
          session
        );
        data = await assetReportService.createAssetReportWithWorkOrder(
          reportBody,
          user,
          reportBody.CreateWorkRequest,
          workOrder,
          correlationId,
          session
        );
        if (!data) {
          throw Object.assign(new Error('Asset report not created'), { status: 404 });
        }
        return queueAssetReportProcessorSync({
          reportId: String(data._id),
          action: 'created',
          tenantId: String(user.account_id),
          actorId: String(user._id),
          correlationId
        }, session);
      });
      if (!data) {
        throw Object.assign(new Error('Asset report not created'), { status: 404 });
      }
      if (!processorQueued) {
        await synchronizeAssetReportProcessor(
          String(data._id),
          'created',
          String(user.account_id),
          String(user._id),
          `${correlationId}:${data._id}`
        );
      }
      res.status(201).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
      next(error);
    }
  };

  updateAssetsReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      body.updatedBy = user_id;
      const correlationId = String(res.locals['correlationId'] || randomUUID());
      let data: any;
      const processorQueued = await withTransaction(async (session) => {
        await assetReportService.requireTenantReferences(body, account_id, session);
        data = await assetReportService.updateAssetReport(
          helperService.validateObjectId(String(id)),
          body,
          account_id,
          user_id,
          session
        );
        if (!data) {
          throw Object.assign(new Error('Asset report not updated'), { status: 404 });
        }
        return queueAssetReportProcessorSync({
          reportId: String(id),
          action: 'updated',
          tenantId: String(account_id),
          actorId: String(user_id),
          correlationId
        }, session);
      });
      if (!data) {
        throw Object.assign(new Error('Asset report not updated'), { status: 404 });
      }
      if (!processorQueued) {
        await synchronizeAssetReportProcessor(
          String(id),
          'updated',
          String(account_id),
          String(user_id),
          `${correlationId}:${id}`
        );
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
      const isAssetReportExists: any = await assetReportService.getAllAssetReports({ _id: helperService.validateObjectId(String(id)), accountId: account_id, visible: true });
      if (!isAssetReportExists || isAssetReportExists.length === 0) {
        throw Object.assign(new Error('Asset report not found'), { status: 404 });
      }
      body.updatedBy = user_id;
      if (body.status === ASSET_REPORT_STATUS[3] && isAssetReportExists[0].status !== ASSET_REPORT_STATUS[3]) {
        body.chartDetail = isAssetReportExists[0].chartDetail.map((item: any) => ({ ...item, compare_time: Math.floor(Date.now() / 1000) }));
      }
      const completed = body.status === ASSET_REPORT_STATUS[3]
        && isAssetReportExists[0].status !== ASSET_REPORT_STATUS[3];
      const correlationId = String(res.locals['correlationId'] || randomUUID());
      let data: any;
      const processorQueued = await withTransaction(async (session) => {
        await assetReportService.requireTenantReferences(body, account_id, session);
        data = await assetReportService.partialUpdateAssetReport(
          helperService.validateObjectId(String(id)),
          body,
          account_id,
          user_id,
          session
        );
        if (!data) {
          throw Object.assign(new Error('Asset report not updated'), { status: 404 });
        }
        if (!completed) return true;
        return queueAssetReportProcessorSync({
          reportId: String(id),
          action: 'completed',
          tenantId: String(account_id),
          actorId: String(user_id),
          correlationId
        }, session);
      });
      if (!data) {
        throw Object.assign(new Error('Asset report not updated'), { status: 404 });
      }
      if (completed && !processorQueued) {
        await synchronizeAssetReportProcessor(
          String(id),
          'completed',
          String(account_id),
          String(user_id),
          `${correlationId}:${id}`
        );
      }
      res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
      next(error);
    }
  };

  deleteAssetsReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const match = { _id: helperService.validateObjectId(String(id)), accountId: account_id, visible: true };
      const isDataExists = await assetReportService.getAllAssetReports(match);
      if (!isDataExists || isDataExists.length === 0) {
        throw Object.assign(new Error('Asset report not found'), { status: 404 });
      }
      const correlationId = String(res.locals['correlationId'] || randomUUID());
      const processorQueued = await withTransaction(async (session) => {
        await observationService.updateObservation(
          {
            report_id: helperService.validateObjectId(String(id)),
            accountId: account_id,
            visible: true
          },
          { report_id: null, updatedBy: user_id },
          session
        );
        const data = await assetReportService.removeAssetReportById(
          helperService.validateObjectId(String(id)),
          account_id,
          user_id,
          session
        );
        if (!data) {
          throw Object.assign(new Error('Asset report not deleted'), { status: 404 });
        }
        return queueAssetReportProcessorSync({
          reportId: String(id),
          action: 'deleted',
          tenantId: String(account_id),
          actorId: String(user_id),
          correlationId
        }, session);
      });
      if (!processorQueued) {
        await synchronizeAssetReportProcessor(
          String(id),
          'deleted',
          String(account_id),
          String(user_id),
          `${correlationId}:${id}`
        );
      }
      res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  generateAssetReportPdf = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { params: { id } } = req;
      const user = get(req, "user", {}) as IUser;
      const body = req.is('multipart/form-data')
        ? parsePdfJsonField<any>(req.body?.payload, {})
        : (req.body || {});
      const files = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];
      const frontendChartImages = createInlineChartImages(files, req.body?.chartManifest);
      const reportId = helperService.validateObjectId(String(id));
      const reports: any[] = await assetReportService.getAllAssetReports({
        _id: reportId,
        accountId: user.account_id,
        visible: true
      });

      if (!reports || reports.length === 0) {
        throw Object.assign(new Error('Asset report not found'), { status: 404 });
      }

      const report = reports[0];

      const payload: any = buildAssetReportPdfPayload(
        report,
        selectPdfRequestPayload(body),
        frontendChartImages
      );
        // Construct readings from endpointRMSData — try all axes for timestamp
      if (!externalAPI.token) {
        throw new Error('Processor API service token is required');
      }
      const pdfBuffer = await this.pdfService.generateAssetReportPdf(
        payload,
        externalAPI.token,
        String(user._id),
        String(user.account_id)
      );
      const assetName = payload.assetName || 'Asset';
      const cleanName = assetName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Asset_Report_${cleanName}_${dateStr}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      applicationLogger.error({ err: error }, 'PDF Generation Error:');
      next(error);
    }
  };

  requestAssetReportPdf = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const reportId = helperService.validateObjectId(String(req.params['id']));
      const reports = await assetReportService.getAllAssetReports({
        _id: reportId,
        accountId: user.account_id,
        visible: true
      });
      if (!reports.length) {
        throw Object.assign(new Error('Asset report not found'), { status: 404 });
      }
      const body = req.is('multipart/form-data')
        ? parsePdfJsonField<any>(req.body?.payload, {})
        : (req.body || {});
      const files = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];
      const job = await assetReportPdfJobService.create({
        reportId: String(reportId),
        tenantId: String(user.account_id),
        actorId: String(user._id),
        correlationId: res.locals['correlationId'] || randomUUID(),
        body,
        files,
        chartManifest: req.body?.chartManifest
      });
      res.status(202).json({
        status: true,
        message: 'PDF generation queued',
        data: assetReportPdfJobService.toPublicStatus(job)
      });
    } catch (error) {
      next(error);
    }
  };

  getAssetReportPdfJob = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const job = await assetReportPdfJobService.requireTenantJob(
        this.requirePdfJobId(req.params['jobId']),
        String(user.account_id)
      );
      res.status(200).json({
        status: true,
        message: 'PDF generation status fetched successfully',
        data: assetReportPdfJobService.toPublicStatus(job)
      });
    } catch (error) {
      next(error);
    }
  };

  getAssetReportPdfDownload = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await assetReportPdfJobService.getDownloadUrl(
        this.requirePdfJobId(req.params['jobId']),
        String(user.account_id)
      );
      res.status(200).json({
        status: true,
        message: 'PDF download URL generated successfully',
        data
      });
    } catch (error: any) {
      if (error?.status === 409) res.setHeader('Retry-After', '2');
      next(error);
    }
  };
}

export const assetReportController = new AssetReportController();
