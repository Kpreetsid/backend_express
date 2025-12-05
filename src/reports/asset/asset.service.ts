import { ReportAssetModel, IReportAsset } from "../../models/assetReport.model";
import { getExternalData } from "../../util/externalAPI";
import { orderService } from "../../work/order/order.service";

class AssetReportService {
  private assetHealthArray = { 1: "Critical", 2: "Danger", 3: "Alert", 4: "Healthy", 5: "Not Defined" };
  
  async getAllAssetReports (match: any, populateFilter?: any) {
    match.$or = [{ visible: true }, { visible: { $exists: false } }];
    return await ReportAssetModel.find(match).sort({ _id: -1 }).populate(populateFilter);
  };
  
  async getLatest (match: any, selectedFields: any) {
    return await ReportAssetModel.findOne(match).select(selectedFields).sort({ _id: -1 }).limit(1);
  };
  
  async createAssetReportWithWorkOrder (body: IReportAsset, user: any, token: any, CreateWorkRequest: number, workOrderBody?: any) {
    let assetReport: any = null;
    let workOrder: any = null;
    try {
      assetReport = new ReportAssetModel({ ...body, accountId: user.account_id, userId: user._id, createdBy: user._id });
      await assetReport.save();
      if (Number(CreateWorkRequest) === 1 && workOrderBody && Object.keys(workOrderBody).length > 0) {
        workOrder = await orderService.createWorkOrder({ asset_report_id: assetReport._id, ...workOrderBody, createdFrom: "Asset Report" }, user);
        await workOrder.save();
        assetReport.work_order_id = workOrder._id;
        await assetReport.save();
      }
      await this.setAssetHealthStatus(body, user.account_id, user._id, token);
      return assetReport;
    } catch (error) {
      if (workOrder?._id) {
        await orderService.deleteWorkOrderById(workOrder._id);
      }
      if (assetReport?._id) {
        await this.deleteAssetReport(assetReport._id);
      }
      throw error;
    }
  };
  
  async setAssetHealthStatus (body: any, account_id: any, user_id: any, token: any) {
    const apiPath = `/asset_health_status/`;
    const payload: any = { "asset_id": body.assetId, "asset_status": this.assetHealthArray[body.EquipmentHealth], "org_id": account_id };
    await getExternalData(apiPath, 'PATCH', payload, token, user_id);
  }
  
  async updateAssetReport (id: string, body: IReportAsset, account_id: any, user_id: any, token: any) {
    await this.setAssetHealthStatus(body, account_id, user_id, token);
    return await ReportAssetModel.findByIdAndUpdate(id, body, { new: true });
  };
  
  async removeAssetReportById (id: string, user_id: any) {
    return await ReportAssetModel.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { new: true });
  }
  
  async deleteAssetReport (id: string) {
    return await ReportAssetModel.findByIdAndDelete(id);
  };
}

export const assetReportService = new AssetReportService();