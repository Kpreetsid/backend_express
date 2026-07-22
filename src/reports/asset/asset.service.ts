import { ReportAssetModel, IReportAsset } from "../../models/assetReport.model";

class AssetReportService {

  private populateFilter = [
    { path: 'locationId', model: "Schema_Location", select: 'id location_name location_type top_level parent_id visible', match: { visible: true } },
    { path: 'assetId', model: "Schema_Asset", select: 'id asset_name asset_type asset_model top_level image_path parent_id visible', match: { visible: true } },
    { path: 'userId', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status', match: { user_status: 'active' } }
  ];

  async getAllAssetReports(match: any) {
    return await ReportAssetModel.find(match).sort({ _id: -1 }).populate(this.populateFilter);
  };

  async getLatest(match: any, selectedFields: any) {
    return await ReportAssetModel.findOne(match).select(selectedFields).sort({ _id: -1 }).limit(1);
  };

  async createAssetReport(body: IReportAsset, user: any) {
    const initialStatus = body.status || 'Open';
    const statusDetails = [{ status: initialStatus, createdBy: user._id, createdAt: new Date() }];
    const assetReport = new ReportAssetModel({
      ...body,
      accountId: user.account_id,
      userId: user._id,
      createdBy: user._id,
      status: initialStatus,
      status_details: statusDetails
    });
    await assetReport.save();
    return assetReport;
  };

  async updateAssetReport(id: any, body: IReportAsset, account_id: any, user_id: any, token: any) {
    return await ReportAssetModel.findByIdAndUpdate(id, body, { returnDocument: 'after' });
  };

  async partialUpdateAssetReport(id: any, body: IReportAsset, user_id: any, token: string) {
    const oldData = await ReportAssetModel.findById(id);
    const newBody: any = { ...oldData?.toObject(), ...body };
    if (body.status) {
      newBody.status_details = [...(newBody.status_details || []), { status: body.status, createdBy: user_id }];
    }
    return await ReportAssetModel.findByIdAndUpdate(id, newBody, { returnDocument: 'after' });
  };

  async removeAssetReportById(id: any, user_id: any) {
    return await ReportAssetModel.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { returnDocument: 'after' });
  }

  async deleteAssetReport(id: any) {
    return await ReportAssetModel.findByIdAndDelete(id);
  };
}

export const assetReportService = new AssetReportService();
