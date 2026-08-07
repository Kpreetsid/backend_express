import { ReportAssetModel, IReportAsset } from "../../models/assetReport.model";
import { orderService } from "../../work/order/order.service";
import { ClientSession } from "mongoose";
import { withTransaction } from "../../utils/transaction.helper";
import { AssetModel } from "../../models/asset.model";
import { LocationModel } from "../../models/location.model";

class AssetReportService {

  private populateFilter = [
    { path: 'locationId', model: "Schema_Location", select: 'id location_name location_type top_level parent_id visible', match: { visible: true } },
    { path: 'assetId', model: "Schema_Asset", select: 'id asset_name asset_type asset_model top_level image_path parent_id visible', match: { visible: true } },
    { path: 'userId', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status', match: { user_status: 'active' } }
  ];

  private sanitizeMutation(body: Partial<IReportAsset>): Record<string, any> {
    const sanitized: Record<string, any> = { ...body };
    for (const field of ['_id', 'accountId', 'userId', 'createdBy', 'updatedBy', 'visible']) {
      delete sanitized[field];
    }
    return sanitized;
  }

  async getAllAssetReports(match: any) {
    return await ReportAssetModel.find(match).sort({ _id: -1 }).populate(this.populateFilter);
  };

  async getLatest(match: any, selectedFields: any) {
    return await ReportAssetModel.findOne(match).select(selectedFields).sort({ _id: -1 }).limit(1);
  };

  async createAssetReportWithWorkOrder(
    body: IReportAsset,
    user: any,
    CreateWorkRequest: number,
    workOrderBody?: any,
    correlationId?: string,
    existingSession?: ClientSession
  ) {
    return await withTransaction(async (session) => {
      const sanitizedBody = this.sanitizeMutation(body);
      const initialStatus = sanitizedBody['status'] || 'Open';
      const statusDetails = [{ status: initialStatus, createdBy: user._id, createdAt: new Date() }];
      const assetReport: any = new ReportAssetModel({
        ...sanitizedBody,
        accountId: user.account_id,
        userId: user._id,
        createdBy: user._id,
        status: initialStatus,
        status_details: statusDetails
      });
      await assetReport.save({ session });
      if (Number(CreateWorkRequest) === 1 && workOrderBody && Object.keys(workOrderBody).length > 0) {
        const workOrder = await orderService.createWorkOrder(
          { asset_report_id: assetReport._id, ...workOrderBody, createdFrom: "Asset Report" },
          user,
          correlationId,
          session
        );
        if (workOrder && workOrder._id) {
          assetReport.work_order_id = workOrder._id;
          await assetReport.save({ session });
        }
      }
      return assetReport;
    }, existingSession);
  };

  async requireTenantReferences(
    body: Partial<IReportAsset>,
    account_id: any,
    session?: ClientSession
  ): Promise<void> {
    const assetIds = [...new Set(
      [body.assetId, body.top_level_asset_id]
        .filter(Boolean)
        .map((id) => String(id))
    )];
    const assetQuery = AssetModel.countDocuments({
      _id: { $in: assetIds },
      account_id,
      visible: true
    });
    const locationQuery = body.locationId
      ? LocationModel.countDocuments({
        _id: body.locationId,
        account_id,
        visible: true
      })
      : null;
    if (session) {
      assetQuery.session(session);
      locationQuery?.session(session);
    }
    const [assetCount, locationCount] = await Promise.all([
      assetIds.length ? assetQuery : Promise.resolve(0),
      locationQuery || Promise.resolve(0)
    ]);
    if (
      (assetIds.length && assetCount !== assetIds.length)
      || (body.locationId && locationCount !== 1)
    ) {
      throw Object.assign(new Error('Asset report references were not found'), { status: 404 });
    }
  }

  async updateAssetReport(
    id: any,
    body: IReportAsset,
    account_id: any,
    user_id: any,
    session?: ClientSession
  ) {
    const sanitizedBody = this.sanitizeMutation(body);
    return await ReportAssetModel.findOneAndUpdate(
      { _id: id, accountId: account_id, visible: true },
      { ...sanitizedBody, accountId: account_id, updatedBy: user_id },
      { returnDocument: 'after', ...(session ? { session } : {}) }
    );
  };

  async partialUpdateAssetReport(
    id: any,
    body: IReportAsset,
    account_id: any,
    user_id: any,
    session?: ClientSession
  ) {
    const oldQuery = ReportAssetModel.findOne({
      _id: id,
      accountId: account_id,
      visible: true
    });
    if (session) oldQuery.session(session);
    const oldData = await oldQuery;
    const sanitizedBody = this.sanitizeMutation(body);
    const newBody: any = { ...oldData?.toObject(), ...sanitizedBody };
    if (sanitizedBody['status']) {
      newBody.status_details = [
        ...(newBody.status_details || []),
        { status: sanitizedBody['status'], createdBy: user_id }
      ];
    }
    return await ReportAssetModel.findOneAndUpdate(
      { _id: id, accountId: account_id, visible: true },
      { ...newBody, accountId: account_id, updatedBy: user_id },
      { returnDocument: 'after', ...(session ? { session } : {}) }
    );
  };

  async removeAssetReportById(
    id: any,
    account_id: any,
    user_id: any,
    session?: ClientSession
  ) {
    return await ReportAssetModel.findOneAndUpdate(
      { _id: id, accountId: account_id, visible: true },
      { updatedBy: user_id, visible: false },
      { returnDocument: 'after', ...(session ? { session } : {}) }
    );
  }

  async deleteAssetReport(id: any, session?: ClientSession) {
    return await ReportAssetModel.findByIdAndDelete(
      id,
      session ? { session } : {}
    );
  };
}

export const assetReportService = new AssetReportService();
