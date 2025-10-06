import { ReportAssetModel, IReportAsset } from "../../models/assetReport.model";

export const getAll = async (match: any, populateFilter?: any) => {
  return await ReportAssetModel.find(match).sort({ _id: -1 }).populate(populateFilter);
};

export const getLatest = async (match: any, selectedFields: any) => {
  return await ReportAssetModel.findOne(match).select(selectedFields).sort({ _id: -1 }).limit(1);
};

export const insertAssetReport = async (body: IReportAsset, account_id: any, user_id: any) => {
  const newAsset = new ReportAssetModel({ ...body, accountId: account_id, createdBy: user_id });
  return await newAsset.save();
};

export const updateAssetReport = async (id: string, body: IReportAsset) => {
  return await ReportAssetModel.findByIdAndUpdate(id, body, { new: true });
};

export const removeAssetReportById = async (id: string, user_id: any) => {
  return await ReportAssetModel.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { new: true });
}

export const deleteAssetReport = async (id: string) => {
  return await ReportAssetModel.findByIdAndDelete(id);
};