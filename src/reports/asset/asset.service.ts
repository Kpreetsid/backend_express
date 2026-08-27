import { ReportAssetModel, IReportAsset } from "../../models/assetReport.model";
import { AssetModel } from "../../models/asset.model";
import { LocationModel } from "../../models/location.model";
import { ObservationModel } from "../../models/observation.model";
import { orderService } from "../../work/order/order.service";

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
      const initialStatus = body.status || 'Open';
      const statusDetails = [{ status: initialStatus, createdBy: user._id, createdAt: new Date() }];
      assetReport = new ReportAssetModel({
        ...body,
        accountId: user.account_id,
        userId: user._id,
        createdBy: user._id,
        status: initialStatus,
        status_details: statusDetails
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
    return await ReportAssetModel.findOneAndUpdate(
      { _id: id, accountId: account_id, visible: true },
      { $set: { ...body, updatedBy: user_id } },
      { returnDocument: 'after', runValidators: true }
    );
  };

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
