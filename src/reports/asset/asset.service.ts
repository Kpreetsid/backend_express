import { ReportAssetModel, IReportAsset, ASSET_REPORT_STATUS } from "../../models/assetReport.model";
import { processorAPIService } from "../../api-processor";
import { orderService } from "../../work/order/order.service";

class AssetReportService {
  async getAllAssetReports(match: any, populateFilter?: any) {
    return await ReportAssetModel.find(match).sort({ _id: -1 }).populate(populateFilter);
  };

  async getLatest(match: any, selectedFields: any) {
    return await ReportAssetModel.findOne(match).select(selectedFields).sort({ _id: -1 }).limit(1);
  };

  async createAssetReportWithWorkOrder(body: IReportAsset, user: any, token: any, CreateWorkRequest: number, workOrderBody?: any) {
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
      await processorAPIService.updateAssetHealthStatusOld(body, user.account_id, user._id, token);
      return assetReport;
    } catch (error) {
      if (workOrder?._id) {
        await orderService.deleteWorkOrderById(workOrder._id, user._id);
      }
      if (assetReport?._id) {
        await this.deleteAssetReport(assetReport._id);
      }
      throw error;
    }
  };

  async updateAssetReport(id: any, body: IReportAsset, account_id: any, user_id: any, token: any) {
    await processorAPIService.updateAssetHealthStatusOld(body, account_id, user_id, token);
    return await ReportAssetModel.findByIdAndUpdate(id, body, { new: true });
  };

  async partialUpdateAssetReport(id: any, body: IReportAsset, user_id: any, token: string) {
    const oldData = await ReportAssetModel.findById(id);
    const newBody: any = { ...oldData?.toObject(), ...body };
    if (body.status) {
      newBody.status_details = [...newBody.status_details, { status: body.status, createdBy: user_id }];
    }
    if(body.status === ASSET_REPORT_STATUS[3]) {
      const payload = { asset_id: body.top_level_asset_id, freeze_score: false };
      await processorAPIService.assetHealthFreezeStatus(payload, user_id, token);
    }
    return await ReportAssetModel.findByIdAndUpdate(id, newBody, { new: true });
  };

  async removeAssetReportById(id: any, user_id: any) {
    return await ReportAssetModel.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { new: true });
  }

  async deleteAssetReport(id: any) {
    return await ReportAssetModel.findByIdAndDelete(id);
  };
}

export const assetReportService = new AssetReportService();