import { ReportAsset, IReportAsset } from "../../models/assetReport.model";

export const getAll = async (match: any, populateFilter?: any) => {
  return await ReportAsset.find(match).sort({ _id: -1 }).populate(populateFilter);
};

export const getLatest = async (match: any, selectedFields: any) => {
  return await ReportAsset.findOne(match).select(selectedFields).sort({ _id: -1 }).limit(1);
};

export const insertAssetReport = async (body: IReportAsset) => {
  const newAsset = new ReportAsset(body);
  return await newAsset.save();
};

export const updateAssetReport = async (id: string, body: IReportAsset) => {
  return await ReportAsset.findByIdAndUpdate(id, body, { new: true });
};

export const deleteAssetReport = async (id: string) => {
  return await ReportAsset.findByIdAndDelete(id);
};