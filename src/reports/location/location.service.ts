import { Asset } from '../../models/asset.model';
import { ReportAsset } from '../../models/assetReport.model';
import { LocationMaster } from '../../models/location.model';
import { ILocationReport, LocationReport } from '../../models/locationReport.model';

export const getAll = async (match: any): Promise<ILocationReport[]> => {
  match.isActive = true;
  const populateFilter = [{ path: 'userId', select: 'firstName lastName' }, { path: 'location_id', select: '' }];
  return await LocationReport.find(match).populate(populateFilter).sort({ _id: -1 });
};

const getMonthList = (): any[] => {
  const now = new Date();
  const result: any[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ month: d.toLocaleString('default', { month: 'short' }), status: null });
  }
  return result.reverse();
};

const fetchAllChildLocationIds = async (locationId: string, account_id: string): Promise<string[]> => {
  const result: string[] = [];
  const stack: string[] = [locationId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    result.push(current);
    const children = await LocationMaster.find({ parent_id: current, account_id, visible: true }).select('_id');
    children.forEach((child: any) => stack.push(child._id.toString()));
  }
  return result;
};

export const createLocationReport = async (match: { account_id: string; location_id: string; user_id: string }) => {
  try {
    const locationIds = await fetchAllChildLocationIds(match.location_id, match.account_id);
    const assets = await Asset.find({ locationId: { $in: locationIds }, account_id: match.account_id, top_level: true, visible: true });

    const reportList = await Promise.all(assets.map(async (asset: any) => {
      const [latestReport] = await ReportAsset.find({ top_level_asset_id: asset._id, accountId: match.account_id }).sort({ _id: -1 }).limit(1);
      return latestReport || null;
    }));

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

    for (const report of reportList.filter(r => r)) {
      const assetHealth = report.EquipmentHealth || '1';
      const faultData = report.faultData || [];
      const locationId = report.locationId.toString();

      // Condition Summary
      switch (assetHealth) {
        case '2': assetConditionSummaryData[1].value.value++; break;
        case '3': assetConditionSummaryData[2].value.value++; break;
        case '4': assetConditionSummaryData[3].value.value++; break;
        case '5': assetConditionSummaryData[4].value.value++; break;
        default:  assetConditionSummaryData[0].value.value++;
      }

      // Fault Summary
      faultData.forEach((f: any) => {
        if (f.value !== 1) {
          const index = assetFaultSummaryData.findIndex(item => item.key === f.name);
          if (index !== -1) {
            assetFaultSummaryData[index].value += 1;
          } else {
            assetFaultSummaryData[6].value += 1; // Other
          }
        }
      });

      // Grouping by sub-location
      if (!subLocationMap[locationId]) {
        subLocationMap[locationId] = {
          sub_location: { id: locationId, name: report.locationName },
          asset_data: []
        };
      }

      subLocationMap[locationId].asset_data.push({
        asset_id: report.top_level_asset_id,
        observations: report.Observations,
        recommendations: report.Recommendations,
        created_on: report.createdOn,
        asset_name: report.assetName,
        location_name: report.locationName,
        fault_data: report.faultData,
        endpointRMSData: report.endpointRMSData,
        healthFlag: report.EquipmentHealth,
        locationId,
        asset_health_history: report.asset_health_history || getMonthList(),
        dummyList: getMonthList()
      });
    }

    // Add per sub-location summaries
    for (const subLoc of Object.values(subLocationMap)) {
      const conditionSummary = JSON.parse(JSON.stringify(assetConditionSummaryData.map(item => ({ ...item, value: { ...item.value, value: 0 } }))));
      const faultSummary = assetFaultSummaryData.map(item => ({ ...item, value: 0 }));

      subLoc.asset_data.forEach((asset: any) => {
        switch (asset.healthFlag) {
          case '2': conditionSummary[1].value.value++; break;
          case '3': conditionSummary[2].value.value++; break;
          case '4': conditionSummary[3].value.value++; break;
          case '5': conditionSummary[4].value.value++; break;
          default:  conditionSummary[0].value.value++;
        }
        asset.fault_data.forEach((f: any) => {
          if (f.value !== 1) {
            const index = faultSummary.findIndex(item => item.key === f.name);
            if (index !== -1) faultSummary[index].value++;
            else faultSummary[6].value++;
          }
        });
      });

      subLoc.sub_location_asset_condition_summary_data = conditionSummary;
      subLoc.sub_location_asset_fault_summary_data = faultSummary;
    }

    const newReport = new LocationReport({
      location_id: match.location_id,
      account_id: match.account_id,
      userId: match.user_id,
      asset_report_data: reportList.filter(r => r),
      asset_condition_summary_data: assetConditionSummaryData,
      asset_fault_summary_data: assetFaultSummaryData,
      sub_location_data: Object.values(subLocationMap),
      createdBy: match.user_id
    });
    return newReport;
    // return await newReport.save();
  } catch (error) {
    throw Object.assign(new Error('Something went wrong'), { status: 500 });
  }
};

export const deleteLocationsReport = async (id: string, accountId: string, user_id: string) => {
  return await LocationReport.findOneAndUpdate({ _id: id, account_id: accountId, isActive: true }, { isActive: false, updatedBy: user_id }, { new: true });
}