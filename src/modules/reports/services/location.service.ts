import { AssetModel } from '../../assets/models/asset.model';
import { ReportAssetModel } from '../models/assetReport.model';
import { LocationModel } from '../../locations/models/location.model';
import { ILocationReport, ReportLocationModel } from '../models/locationReport.model';

class LocationReportService {
  private readonly reportLimit = 2000;
  private readonly hierarchyLimit = 5000;
  private readonly assetLimit = 5000;

  async getAll(match: any, accountId: any = match?.account_id): Promise<ILocationReport[]> {
    const filter = { ...match, visible: true };
    const populateFilter = [
      {
        path: 'userId',
        model: 'Schema_User',
        select: 'id firstName lastName email username user_role user_profile_img user_status',
        match: { account_id: accountId, user_status: 'active' }
      },
      {
        path: 'location_id',
        model: 'Schema_Location',
        select: 'id location_name location_type top_level parent_id visible image_path',
        match: { account_id: accountId, visible: true }
      }
    ];
    return await ReportLocationModel.find(filter)
      .sort({ _id: -1 })
      .limit(this.reportLimit)
      .populate(populateFilter);
  }

  getDummyMonthList() {
    const now = new Date();
    const result: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push({ date: d.toLocaleString('default', { month: 'short' }) + '-' + d.getFullYear() });
    }
    return result;
  }

  async fetchAllChildLocationIds(locationId: string, accountId: string): Promise<string[]> {
    const visited = new Set<string>();
    let frontier: string[] = [locationId];
    while (frontier.length > 0) {
      const batch = frontier.filter(id => !visited.has(String(id)));
      frontier = [];
      if (!batch.length) continue;
      for (const id of batch) visited.add(String(id));
      if (visited.size > this.hierarchyLimit) {
        throw Object.assign(new Error(`Location hierarchy exceeds the ${this.hierarchyLimit} location limit`), { status: 400 });
      }
      const children: any[] = await LocationModel.find({
        parent_id: { $in: batch },
        account_id: accountId,
        visible: true
      }).select('_id').lean();
      frontier = children.map(child => String(child._id)).filter(id => !visited.has(id));
    }
    return [...visited];
  }

  getAssetHealthHistory() {
    const now = new Date();
    const result: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push({ date: d.toLocaleString('default', { month: 'short' }) + '-' + String(d.getFullYear()).slice(-2), status: '5' });
    }
    return result;
  }

  async createLocationReport(locationId: string, user: any): Promise<any> {
    const rootLocation = await LocationModel.findOne({
      _id: locationId,
      account_id: user.account_id,
      visible: true,
      top_level: true
    }).select('_id').lean();
    if (!rootLocation) {
      throw Object.assign(new Error('Top level location does not belong to the active account'), { status: 400 });
    }

    const locationIds = await this.fetchAllChildLocationIds(locationId, String(user.account_id));
    const assets: any[] = await AssetModel.find({
      locationId: { $in: locationIds },
      account_id: user.account_id,
      top_level: true,
      visible: true
    }).select('_id').limit(this.assetLimit + 1).lean();
    if (assets.length > this.assetLimit) {
      throw Object.assign(new Error(`Location report cannot contain more than ${this.assetLimit} assets`), { status: 400 });
    }
    if (!assets.length) {
      throw Object.assign(new Error('No asset found under this location.'), { status: 404 });
    }

    const assetIds = assets.map(asset => asset._id);
    const latestReports = await ReportAssetModel.aggregate([
      {
        $match: {
          top_level_asset_id: { $in: assetIds },
          accountId: user.account_id,
          visible: true
        }
      },
      { $sort: { top_level_asset_id: 1, createdOn: -1, _id: -1 } },
      { $group: { _id: '$top_level_asset_id', report: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$report' } },
      { $limit: this.assetLimit }
    ]);
    await ReportAssetModel.populate(latestReports, [
      {
        path: 'userId',
        model: 'Schema_User',
        select: 'firstName lastName email username user_role user_profile_img user_status',
        match: { account_id: user.account_id, user_status: 'active' }
      },
      {
        path: 'locationId',
        model: 'Schema_Location',
        select: 'id location_name location_type top_level parent_id visible',
        match: { account_id: user.account_id, visible: true }
      },
      {
        path: 'assetId',
        model: 'Schema_Asset',
        select: 'id asset_name asset_type asset_model top_level parent_id visible',
        match: { account_id: user.account_id, visible: true }
      }
    ]);
    const validReports = latestReports.filter((report: any) => report?.locationId && report?.assetId);
    if (!validReports.length) {
      throw Object.assign(new Error('No asset report found under this location.'), { status: 404 });
    }

    const assetConditionSummaryData = this.emptyConditionSummary();
    const assetFaultSummaryData = this.emptyFaultSummary();
    const subLocationMap: Record<string, any> = {};

    validReports.forEach((report: any) => {
      const reportLocationId = String(report.locationId._id || report.locationId.id || '');
      if (!reportLocationId) return;
      const health = String(report.EquipmentHealth || '1');
      const faults = Array.isArray(report.faultData) ? report.faultData : [];
      this.incrementCondition(assetConditionSummaryData, health);
      this.incrementFaults(assetFaultSummaryData, faults);

      if (!subLocationMap[reportLocationId]) {
        subLocationMap[reportLocationId] = {
          sub_location: { id: reportLocationId, name: report.locationId.location_name || '' },
          asset_data: []
        };
      }
      subLocationMap[reportLocationId].asset_data.push({
        asset_id: report.top_level_asset_id,
        asset_name: report.assetId.asset_name || report.assetName || '',
        observations: report.Observations || '',
        recommendations: report.Recommendations || '',
        created_on: report.createdOn || report.createdAt,
        location_name: report.locationId.location_name || '',
        fault_data: faults,
        endpointRMSData: Array.isArray(report.endpointRMSData) ? report.endpointRMSData : [],
        healthFlag: health,
        locationId: reportLocationId,
        asset_health_history: Array.isArray(report.asset_health_history) && report.asset_health_history.length
          ? report.asset_health_history
          : this.getAssetHealthHistory(),
        dummyList: this.getDummyMonthList().map((month: any) => ({ ...month, status: '1' }))
      });
    });

    for (const location of Object.values(subLocationMap)) {
      const conditionSummary = this.emptyConditionSummary();
      const faultSummary = this.emptyFaultSummary();
      for (const asset of location.asset_data) {
        this.incrementCondition(conditionSummary, String(asset.healthFlag || '1'));
        this.incrementFaults(faultSummary, Array.isArray(asset.fault_data) ? asset.fault_data : []);
      }
      location.sub_location_asset_condition_summary_data = conditionSummary;
      location.sub_location_asset_fault_summary_data = faultSummary;
    }

    const assetReportData = Object.values(subLocationMap).flatMap((location: any) => location.asset_data);
    const insertData = new ReportLocationModel({
      asset_condition_summary_data: assetConditionSummaryData,
      asset_fault_summary_data: assetFaultSummaryData,
      asset_report_data: assetReportData,
      sub_location_data: Object.values(subLocationMap),
      location_id: rootLocation._id,
      account_id: user.account_id,
      createdBy: user._id,
      userId: user._id
    });
    return await insertData.save();
  }

  async deleteLocationsReport(id: any, accountId: any, userId: any) {
    return await ReportLocationModel.findOneAndUpdate(
      { _id: id, account_id: accountId, visible: true },
      { $set: { visible: false, updatedBy: userId } },
      { returnDocument: 'after' }
    );
  }

  async updateLocationReport(id: any, data: any, user: any) {
    return await ReportLocationModel.findOneAndUpdate(
      { _id: id, account_id: user.account_id, visible: true },
      { $set: { ...data, updatedBy: user._id } },
      { returnDocument: 'after', runValidators: true }
    );
  }

  private emptyConditionSummary(): any[] {
    return [
      { key: 'Critical', value: { value: 0, itemStyle: { color: '#FB565A' } } },
      { key: 'Danger', value: { value: 0, itemStyle: { color: '#FA8349' } } },
      { key: 'Alert', value: { value: 0, itemStyle: { color: '#F7FA4B' } } },
      { key: 'Healthy', value: { value: 0, itemStyle: { color: '#51FC4C' } } },
      { key: 'Not Defined', value: { value: 0, itemStyle: { color: '#B0B0B0' } } }
    ];
  }

  private emptyFaultSummary(): any[] {
    return [
      { key: 'Unbalance', value: 0 },
      { key: 'Misalignment', value: 0 },
      { key: 'Bearing Issue', value: 0 },
      { key: 'Rotating Looseness', value: 0 },
      { key: 'Coupling Issue', value: 0 },
      { key: 'Structural Looseness', value: 0 },
      { key: 'Other', value: 0 }
    ];
  }

  private incrementCondition(summary: any[], health: string): void {
    const index = health === '2' ? 1 : health === '3' ? 2 : health === '4' ? 3 : health === '5' ? 4 : 0;
    summary[index].value.value += 1;
  }

  private incrementFaults(summary: any[], faults: any[]): void {
    for (const fault of faults) {
      if (Number(fault?.value) === 1) continue;
      const index = summary.findIndex(item => item.key === String(fault?.name || '').trim());
      summary[index >= 0 ? index : summary.length - 1].value += 1;
    }
  }
}

export const locationReportService = new LocationReportService();
