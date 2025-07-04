import { ILocationReport, LocationReport } from '../../models/locationReport.model';

export const getAll = async (match: any) => {
  return await LocationReport.find(match).sort({ _id: -1 });
};

export const createLocationsReport = async (body: ILocationReport) => {
  const newLocationReport = new LocationReport(body);
  return await newLocationReport.save();
};

export const deleteLocationsReport = async (id: string, accountId: string) => {
  return await LocationReport.deleteOne({ _id: id, accountId: accountId });
}