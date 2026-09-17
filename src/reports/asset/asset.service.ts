import { ReportAssetModel, IReportAsset } from "../../models/assetReport.model";
import { AssetModel } from "../../models/asset.model";
import { LocationModel } from "../../models/location.model";
import { ObservationModel } from "../../models/observation.model";
import { orderService } from "../../work/order/order.service";
import {
  assertDiagnosticLifecycleTransition,
  hasAuthoritativeDiagnosticFinding,
  isCurrentDiagnosticLifecycle,
  resolveCreationDiagnosticLifecycle,
} from './diagnostic-lifecycle';

const SERVICE_CREATE_FIELDS = new Set([
  'top_level_asset_id', 'assetId', 'locationId', 'Observations', 'Recommendations',
  'CreateWorkRequest', 'FaultDetected', 'Severity', 'NewFault', 'ISO', 'TrendOfAlarm',
  'EquipmentHealth', 'files', 'harmonicIndex', 'alarmId', 'createdFrom', 'chartDetail',
  'assetName', 'locationName', 'faultData', 'assetImage', 'asset_health_history',
  'endpointRMSData', 'diagnosticLifecycle'
]);

const SERVICE_UPDATE_FIELDS = new Set([
  'Observations', 'Recommendations', 'CreateWorkRequest', 'FaultDetected', 'Severity',
  'NewFault', 'ISO', 'TrendOfAlarm', 'EquipmentHealth', 'files', 'harmonicIndex',
  'chartDetail', 'faultData', 'asset_health_history', 'endpointRMSData', 'diagnosticLifecycle'
]);

function pickFields(input: any, allowed: Set<string>): Record<string, any> {
  const output: Record<string, any> = {};
  if (!input || typeof input !== 'object') return output;
  for (const [key, value] of Object.entries(input)) {
    if (allowed.has(key)) output[key] = value;
  }
  return output;
}

function lifecycleBadRequest(error: unknown): never {
  const message = error instanceof Error ? error.message : 'Invalid diagnostic lifecycle';
  throw Object.assign(new Error(message), { status: 400 });
}

class AssetReportService {
  private readonly resultLimit = 2000;

  private populateFilter(accountId: any) {
    return [
      { path: 'locationId', model: "Schema_Location", select: 'id location_name location_type top_level parent_id visible', match: { account_id: accountId, visible: true } },
      { path: 'assetId', model: "Schema_Asset", select: 'id asset_name asset_type asset_model top_level image_path parent_id visible', match: { account_id: accountId, visible: true } },
      { path: 'userId', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status', match: { account_id: accountId, user_status: 'active' } }
    ];
  }

  async getAllAssetReports(match: any, accountId: any = match?.accountId) {
    return await ReportAssetModel.find(match)
      .sort({ _id: -1 })
      .limit(this.resultLimit)
      .populate(this.populateFilter(accountId));
  };

  async getLatest(match: any, selectedFields: any) {
    return await ReportAssetModel.findOne(match).select(selectedFields).sort({ _id: -1 }).limit(1);
  };

  async getAssetReportRecord(match: any): Promise<any> {
    return await ReportAssetModel.findOne(match).lean();
  }

  async assertAssetReportReferences(body: any, accountId: any): Promise<void> {
    const [asset, location, topLevelAsset] = await Promise.all([
      AssetModel.findOne({ _id: body.assetId, account_id: accountId, visible: true })
        .select('_id locationId top_level top_level_asset_id')
        .lean(),
      LocationModel.findOne({ _id: body.locationId, account_id: accountId, visible: true })
        .select('_id')
        .lean(),
      AssetModel.findOne({ _id: body.top_level_asset_id, account_id: accountId, visible: true, top_level: true })
        .select('_id')
        .lean()
    ]);
    if (!asset) throw badRequest('Asset does not belong to the active account');
    if (!location) throw badRequest('Location does not belong to the active account');
    if (!topLevelAsset) throw badRequest('Top level asset does not belong to the active account');
    if (String(asset.locationId || '') !== String(body.locationId)) {
      throw badRequest('Asset and location do not match');
    }
    const expectedTopLevelId = asset.top_level ? asset._id : asset.top_level_asset_id;
    if (String(expectedTopLevelId || '') !== String(body.top_level_asset_id)) {
      throw badRequest('Asset and top level asset do not match');
    }
  }

  async assertReportObservation(reportId: any, observationId: any, accountId: any): Promise<void> {
    const exists = await ObservationModel.exists({
      _id: observationId,
      report_id: reportId,
      accountId,
      visible: true
    });
    if (!exists) throw badRequest('Observation does not belong to this report');
  }

  async createAssetReportWithWorkOrder(body: IReportAsset, user: any, token: any, CreateWorkRequest: number, workOrderBody?: any) {
    let assetReport: any = null;
    let workOrder: any = null;
    try {
      const cleanBody = pickFields(body, SERVICE_CREATE_FIELDS);
      let diagnosticLifecycle;
      try {
        diagnosticLifecycle = resolveCreationDiagnosticLifecycle(
          cleanBody.FaultDetected,
          cleanBody.faultData,
          cleanBody.diagnosticLifecycle,
        );
      } catch (error) {
        lifecycleBadRequest(error);
      }
      delete cleanBody.diagnosticLifecycle;

      const initialStatus = 'Open';
      const statusDetails = [{ status: initialStatus, createdBy: user._id, createdAt: new Date() }];
      const lifecycleUpdatedAt = new Date();
      assetReport = new ReportAssetModel({
        ...cleanBody,
        accountId: user.account_id,
        userId: user._id,
        createdBy: user._id,
        status: initialStatus,
        status_details: statusDetails,
        diagnosticLifecycle,
        diagnosticLifecycleUpdatedAt: lifecycleUpdatedAt,
        diagnosticLifecycleUpdatedBy: user._id,
        ...(diagnosticLifecycle === 'RESOLVED' ? { resolvedAt: lifecycleUpdatedAt } : {})
      });
      await assetReport.save();
      if (Number(CreateWorkRequest) === 1 && workOrderBody && Object.keys(workOrderBody).length > 0) {
        workOrder = await orderService.createWorkOrder({ ...workOrderBody, asset_report_id: assetReport._id, createdFrom: "Asset Report" }, user);
        if (workOrder && workOrder._id) {
          assetReport.work_order_id = workOrder._id;
          await assetReport.save();
        }
      }
      return assetReport;
    } catch (error) {
      if (workOrder?._id) {
        await orderService.deleteWorkOrderById(workOrder._id, user);
      }
      if (assetReport?._id) {
        await this.deleteAssetReport(assetReport._id, user.account_id);
      }
      throw error;
    }
  };

  async updateAssetReport(id: any, body: Partial<IReportAsset>, account_id: any, user_id: any, token?: any) {
    const existing: any = await ReportAssetModel.findOne({ _id: id, accountId: account_id, visible: true });
    if (!existing) return null;

    const incoming = pickFields(body, SERVICE_UPDATE_FIELDS);
    const requestedLifecycle = incoming.diagnosticLifecycle;
    delete incoming.diagnosticLifecycle;

    const resultingFaultDetected = Object.prototype.hasOwnProperty.call(incoming, 'FaultDetected')
      ? incoming.FaultDetected
      : existing.FaultDetected;
    const resultingFaultData = Object.prototype.hasOwnProperty.call(incoming, 'faultData')
      ? incoming.faultData
      : existing.faultData;

    const update: any = { $set: { ...incoming, updatedBy: user_id } };
    if (requestedLifecycle !== undefined && requestedLifecycle !== null) {
      try {
        const next = assertDiagnosticLifecycleTransition({
          currentLifecycle: existing.diagnosticLifecycle,
          nextLifecycle: requestedLifecycle,
          resultingFaultDetected,
          resultingFaultData,
        });
        const now = new Date();
        update.$set.diagnosticLifecycle = next;
        update.$set.diagnosticLifecycleUpdatedAt = now;
        update.$set.diagnosticLifecycleUpdatedBy = user_id;
        if (next === 'RESOLVED') {
          update.$set.resolvedAt = now;
        } else if (existing.resolvedAt) {
          update.$unset = { resolvedAt: 1 };
        }
      } catch (error) {
        lifecycleBadRequest(error);
      }
    } else if (
      isCurrentDiagnosticLifecycle(existing.diagnosticLifecycle)
      && !hasAuthoritativeDiagnosticFinding(resultingFaultDetected, resultingFaultData)
    ) {
      throw badRequest('Clearing an ACTIVE/MONITORING diagnosis requires an explicit RESOLVED or HISTORICAL diagnosticLifecycle transition');
    }

    return await ReportAssetModel.findOneAndUpdate(
      { _id: id, accountId: account_id, visible: true },
      update,
      { returnDocument: 'after', runValidators: true }
    );
  };

  async transitionDiagnosticLifecycle(id: any, accountId: any, userId: any, requestedLifecycle: unknown) {
    const existing: any = await ReportAssetModel.findOne({ _id: id, accountId, visible: true });
    if (!existing) return null;

    let next;
    try {
      next = assertDiagnosticLifecycleTransition({
        currentLifecycle: existing.diagnosticLifecycle,
        nextLifecycle: requestedLifecycle,
        resultingFaultDetected: existing.FaultDetected,
        resultingFaultData: existing.faultData,
      });
    } catch (error) {
      lifecycleBadRequest(error);
    }

    const now = new Date();
    const filter: any = { _id: id, accountId, visible: true };
    if (existing.diagnosticLifecycle) {
      filter.diagnosticLifecycle = existing.diagnosticLifecycle;
    } else {
      filter.$or = [
        { diagnosticLifecycle: { $exists: false } },
        { diagnosticLifecycle: null }
      ];
    }

    const update: any = {
      $set: {
        diagnosticLifecycle: next,
        diagnosticLifecycleUpdatedAt: now,
        diagnosticLifecycleUpdatedBy: userId,
        updatedBy: userId,
      }
    };
    if (next === 'RESOLVED') {
      update.$set.resolvedAt = now;
    } else if (existing.resolvedAt) {
      update.$unset = { resolvedAt: 1 };
    }

    return await ReportAssetModel.findOneAndUpdate(
      filter,
      update,
      { returnDocument: 'after', runValidators: true }
    );
  }

  async partialUpdateAssetReport(
    id: any,
    accountId: any,
    previousStatus: string,
    body: Partial<IReportAsset>,
    userId: any,
    token?: string
  ) {
    const isTransition = Boolean(body.status && body.status !== previousStatus);
    const update: any = { $set: { ...body, updatedBy: userId } };
    if (isTransition) {
      update.$push = { status_details: { status: body.status, createdBy: userId, createdAt: new Date() } };
    }
    return await ReportAssetModel.findOneAndUpdate(
      { _id: id, accountId, visible: true, status: previousStatus },
      update,
      { returnDocument: 'after', runValidators: true }
    );
  };

  async removeAssetReportById(id: any, accountId: any, userId: any) {
    return await ReportAssetModel.findOneAndUpdate(
      { _id: id, accountId, visible: true },
      { $set: { updatedBy: userId, visible: false } },
      { returnDocument: 'after' }
    );
  }

  async deleteAssetReport(id: any, accountId?: any) {
    return await ReportAssetModel.findOneAndDelete(accountId ? { _id: id, accountId } : { _id: id });
  };

  async rollbackCreatedAssetReport(id: any, user: any): Promise<void> {
    const report: any = await ReportAssetModel.findOne({ _id: id, accountId: user.account_id }).lean();
    if (report?.work_order_id) {
      await orderService.deleteWorkOrderById(report.work_order_id, user);
    }
    await this.deleteAssetReport(id, user.account_id);
  };
}

function badRequest(message: string): Error {
  return Object.assign(new Error(message), { status: 400 });
}

export const assetReportService = new AssetReportService();
