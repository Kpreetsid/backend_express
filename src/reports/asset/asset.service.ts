import { ReportAssetModel, IReportAsset } from "../../models/assetReport.model";
import { orderService } from "../../work/order/order.service";
import { AssetModel } from '../../models/asset.model';
import { LocationModel } from '../../models/location.model';
import { WorkOrderModel } from '../../models/workOrder.model';
import { ObservationModel } from '../../models/observation.model';
import { applyRoleFilter } from '../../utils/roleFilter';

class AssetReportService {
  private editableBody(body: any): any {
    const fields = ['top_level_asset_id', 'assetId', 'work_order_id', 'status', 'Observations', 'observationId',
      'Recommendations', 'CreateWorkRequest', 'FaultDetected', 'Severity', 'NewFault', 'ISO', 'TrendOfAlarm',
      'EquipmentHealth', 'files', 'harmonicIndex', 'alarmId', 'createdFrom', 'chartDetail', 'assetName',
      'locationId', 'locationName', 'faultData', 'assetImage', 'asset_health_history', 'endpointRMSData'];
    return Object.fromEntries(fields.filter(key => Object.prototype.hasOwnProperty.call(body || {}, key)).map(key => [key, body[key]]));
  }

  async getAccessFilter(user: any, baseFilter: Record<string, any> = {}): Promise<any> {
    const direct = await applyRoleFilter({ user, baseFilter, accountField: 'accountId', mapping: 'asset', idField: 'assetId' });
    if (!['manager', 'employee', 'customer'].includes(user.user_role)) return direct;
    const root = await applyRoleFilter({ user, baseFilter, accountField: 'accountId', mapping: 'asset', idField: 'top_level_asset_id' });
    return {
      accountId: user.account_id, visible: true,
      $or: [direct, { $and: [{ $or: [{ assetId: null }, { assetId: { $exists: false } }] }, root] }]
    };
  }

  private async accessFilter(id: any, user: any): Promise<any> {
    return this.getAccessFilter(user, { _id: id });
  }

  private async validateReferences(body: any, user: any): Promise<void> {
    const references = [
      ['assetId', AssetModel, 'asset', 'account_id'], ['top_level_asset_id', AssetModel, 'asset', 'account_id'],
      ['locationId', LocationModel, 'location', 'account_id'], ['work_order_id', WorkOrderModel, '', 'account_id'],
      ['observationId', ObservationModel, '', 'accountId']
    ] as const;
    for (const [key, model, mapping, accountField] of references) {
      if (!body[key]) continue;
      const filter = await applyRoleFilter({ user, baseFilter: { _id: body[key] }, accountField, mapping });
      if (!await (model as any).exists(filter)) {
        throw Object.assign(new Error('Referenced report object is unavailable or outside your scope'), { status: 403 });
      }
    }
  }

  private populateFilter = [
    { path: 'locationId', model: "Schema_Location", select: 'id location_name location_type top_level parent_id visible', match: { visible: true } },
    { path: 'assetId', model: "Schema_Asset", select: 'id asset_name asset_type asset_model top_level image_path parent_id visible', match: { visible: true } },
    { path: 'userId', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status', match: { user_status: 'active' } }
  ];

  async getAllAssetReports(match: any) {
    const populate = this.populateFilter.map(item => ({ ...item, match: { ...item.match, ...(match.accountId ? { account_id: match.accountId } : {}) } }));
    return await ReportAssetModel.find(match).sort({ _id: -1 }).populate(populate);
  };

  async getLatest(match: any, selectedFields: any) {
    return await ReportAssetModel.findOne(match).select(selectedFields).sort({ _id: -1 }).limit(1);
  };

  async createAssetReportWithWorkOrder(body: IReportAsset, user: any, token: any, CreateWorkRequest: number, workOrderBody?: any) {
    let assetReport: any = null;
    let workOrder: any = null;
    try {
      body = this.editableBody(body);
      await this.validateReferences(body, user);
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
        await this.deleteAssetReport(assetReport._id);
      }
      throw error;
    }
  };

  async updateAssetReport(id: any, body: IReportAsset, account_id: any, user_id: any, token: any, user: any) {
    const filter = await this.accessFilter(id, user);
    if (!await ReportAssetModel.findOne(filter)) return null;
    const update = this.editableBody(body);
    await this.validateReferences(update, user);
    return await ReportAssetModel.findOneAndUpdate(filter, { ...update, updatedBy: user_id }, { returnDocument: 'after', runValidators: true });
  };

  async partialUpdateAssetReport(id: any, body: IReportAsset, user_id: any, token: string, user: any) {
    const filter = await this.accessFilter(id, user);
    const oldData = await ReportAssetModel.findOne(filter);
    if (!oldData) return null;
    const newBody: any = this.editableBody(body);
    await this.validateReferences(newBody, user);
    if (body.status) {
      newBody.status_details = [...(oldData.status_details || []), { status: body.status, createdBy: user_id }];
    }
    return await ReportAssetModel.findOneAndUpdate(filter, { ...newBody, updatedBy: user_id }, { returnDocument: 'after', runValidators: true });
  };

  async removeAssetReportById(id: any, user_id: any, user: any) {
    return await ReportAssetModel.findOneAndUpdate(await this.accessFilter(id, user), { updatedBy: user_id, visible: false }, { returnDocument: 'after' });
  }

  async deleteAssetReport(id: any) {
    return await ReportAssetModel.findByIdAndDelete(id);
  };
}

export const assetReportService = new AssetReportService();
