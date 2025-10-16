import { Request, Response, NextFunction } from 'express';
import { AssetModel } from '../../models/asset.model';
import { ReportAssetModel } from '../../models/assetReport.model';
import { LocationModel } from '../../models/location.model';
import { ILocationReport, ReportLocationModel } from '../../models/locationReport.model';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { getAllUsers } from '../../masters/user/user.service';

export const getAll = async (match: any): Promise<ILocationReport[]> => {
  match.visible = true;
  const populateFilter = [{ path: 'userId', model: "Schema_User", select: 'id firstName lastName' }, { path: 'location_id', model: "Schema_Location", select: '' }];
  return await ReportLocationModel.find(match).populate(populateFilter).sort({ _id: -1 });
};

const getDummyMonthList = (): any[] => {
  const now = new Date();
  const result: any[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ date: d.toLocaleString('default', { month: 'short' }) + '-' + d.getFullYear() });
  }
  return result;
};

const fetchAllChildLocationIds = async (locationId: string, account_id: string): Promise<string[]> => {
  const result: string[] = [];
  const stack: string[] = [locationId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    result.push(current);
    const children = await LocationModel.find({ parent_id: current, account_id, visible: true }).select('_id');
    children.forEach((child: any) => stack.push(child._id.toString()));
  }
  return result;
};

const getAssetHealthHistory = (): any[] => {
  const now = new Date();
  const result: any[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ date: d.toLocaleString('default', { month: 'short' }) + '-' + String(d.getFullYear()).slice(-2), status: "5" });
  }
  return result;
};

export const createLocationReport = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { location_id } = req.body;
    if (!location_id) {
      throw Object.assign(new Error('Invalid request data'), { status: 400 });
    }
    const userDetails = await getAllUsers({ _id: user_id, account_id: account_id, user_status: 'active' });
    if (!userDetails || userDetails.length === 0) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }
    const locationIds = await fetchAllChildLocationIds(location_id, `${account_id}`);
    locationIds.push(location_id);
    const assets = await AssetModel.find({ locationId: { $in: locationIds }, account_id, top_level: true, visible: true });
    if (!assets || assets.length === 0) {
      throw Object.assign(new Error('No asset found under this location.'), { status: 404 });
    }
    const reportList = await Promise.all(assets.map(async (asset: any) => {
      const [latestReport] = await ReportAssetModel.find({ top_level_asset_id: asset._id, accountId: account_id }).sort({ createdOn: -1 }).populate([{ path: 'userId', model: "Schema_User", select: 'firstName lastName' }, { path: 'locationId', model: "Schema_Location", select: '' }, { path: 'assetId', model: "Schema_Asset", select: '' }]).limit(1);
      return latestReport || null;
    }));
    const validReports = reportList.filter(Boolean);
    if (validReports.length === 0) {
      throw Object.assign(new Error('No asset report found under this location.'), { status: 404 });
    }
    const assetConditionSummaryData = [
      { key: 'Critical', value: { value: 0, itemStyle: { color: '#FB565A' } } },
      { key: 'Danger', value: { value: 0, itemStyle: { color: '#FA8349' } } },
      { key: 'Alert', value: { value: 0, itemStyle: { color: '#F7FA4B' } } },
      { key: 'Healthy', value: { value: 0, itemStyle: { color: '#51FC4C' } } },
      { key: 'Not Defined', value: { value: 0, itemStyle: { color: '#B0B0B0' } } }
    ];
    const assetFaultSummaryData = [
      { key: 'Unbalance', value: 0 },
      { key: 'Misalignment', value: 0 },
      { key: 'Bearing Issue', value: 0 },
      { key: 'Rotating Looseness', value: 0 },
      { key: 'Coupling Issue', value: 0 },
      { key: 'Structural Looseness', value: 0 },
      { key: 'Other', value: 0 }
    ];

    const subLocationMap: Record<string, any> = {};
    validReports.forEach((report: any) => {
      const locationId = report?.locationId?._id;
      const health = report.EquipmentHealth || '1';
      const faults = report.faultData || [];

      switch (health) {
        case '2': assetConditionSummaryData[1].value.value++; break;
        case '3': assetConditionSummaryData[2].value.value++; break;
        case '4': assetConditionSummaryData[3].value.value++; break;
        case '5': assetConditionSummaryData[4].value.value++; break;
        default:  assetConditionSummaryData[0].value.value++;
      }
      faults.forEach((f: any) => {
        if (f.value !== 1) {
          const idx = assetFaultSummaryData.findIndex(item => item.key === f.name);
          if (idx !== -1) {
            assetFaultSummaryData[idx].value++;
          } else {
            assetFaultSummaryData[6].value++;
          }
        }
      });
      if (!subLocationMap[locationId]) {
        subLocationMap[locationId] = {
          sub_location: { id: locationId, name: report?.locationId?.location_name },
          asset_data: []
        };
      }
      subLocationMap[locationId].asset_data.push({
        asset_id: report.top_level_asset_id,
        asset_name: report.assetId.asset_name,
        observations: report.Observations,
        recommendations: report.Recommendations,
        created_on: report.createdOn,
        location_name: report.locationId.location_name,
        fault_data: report.faultData,
        endpointRMSData: report.endpointRMSData,
        healthFlag: report.EquipmentHealth,
        locationId,
        asset_health_history: report.asset_health_history || getAssetHealthHistory(),
        dummyList: getDummyMonthList().map((month: any) => {
          month.status = '1';
          return month;
        })
      });
    });

    for (const loc of Object.values(subLocationMap)) {
      const conditionSummary = assetConditionSummaryData.map(item => ({ ...item, value: { ...item.value, value: 0 } }));
      const faultSummary = assetFaultSummaryData.map(item => ({ ...item, value: 0 }));
      loc.asset_data.forEach((asset: any) => {
        switch (asset.healthFlag) {
          case '2': conditionSummary[1].value.value++; break;
          case '3': conditionSummary[2].value.value++; break;
          case '4': conditionSummary[3].value.value++; break;
          case '5': conditionSummary[4].value.value++; break;
          default:  conditionSummary[0].value.value++;
        }
        asset.fault_data.forEach((f: any) => {
          if (f.value !== 1) {
            const idx = faultSummary.findIndex(item => item.key === f.name);
            if (idx !== -1) faultSummary[idx].value++;
            else faultSummary[6].value++;
          }
        });
      });

      loc.sub_location_asset_condition_summary_data = conditionSummary;
      loc.sub_location_asset_fault_summary_data = faultSummary;
    }
    const assetReportData = Object.values(subLocationMap).flatMap((loc: any) => loc.asset_data);
    const insertData = new ReportLocationModel({
      asset_condition_summary_data: assetConditionSummaryData,
      asset_fault_summary_data: assetFaultSummaryData,
      asset_report_data: assetReportData,
      sub_location_data: Object.values(subLocationMap),
      location_id,
      account_id,
      createdBy: user_id,
      userId: user_id,
      user: userDetails[0]
    });
    await insertData.save();
    return res.status(200).json({ status: true, message: 'Location Report Created Successfully' });
  } catch (error) {
    next(error);
  }
};

export const deleteLocationsReport = async (id: string, accountId: string, user_id: string) => {
  return await ReportLocationModel.findOneAndUpdate({ _id: id, account_id: accountId, visible: true }, { visible: false, updatedBy: user_id }, { new: true });
};