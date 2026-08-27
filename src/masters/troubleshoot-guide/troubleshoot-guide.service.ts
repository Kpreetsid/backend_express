import { TroubleshootGuideModel } from '../../models/troubleshootGuide.model';

class TroubleshootGuideService {
  async getAllTroubleshootGuide(match: Record<string, any>): Promise<any[]> {
    const populateList = [
      { path: 'locationId', model: 'Schema_Location', select: 'id location_name location_type top_level parent_id visible', match: { visible: true } },
      { path: 'assetId', model: 'Schema_Asset', select: 'id asset_name asset_type asset_model top_level parent_id visible', match: { visible: true } }
    ];
    return TroubleshootGuideModel.find({ ...match, visible: true })
      .populate(populateList)
      .sort({ createdAt: -1, _id: -1 })
      .limit(500)
      .lean();
  }

  async insertTroubleshootGuide(body: Record<string, any>, accountId: any, userId: any): Promise<any> {
    return new TroubleshootGuideModel({ ...body, account_id: accountId, createdBy: userId }).save();
  }

  async updateTroubleshootGuide(match: Record<string, any>, body: Record<string, any>, userId: any): Promise<any> {
    return TroubleshootGuideModel.findOneAndUpdate(
      { ...match, visible: true },
      { $set: { ...body, updatedBy: userId } },
      { new: true, runValidators: true }
    ).lean();
  }

  async removeTroubleshootGuide(match: Record<string, any>, userId: any): Promise<any> {
    return TroubleshootGuideModel.findOneAndUpdate(
      { ...match, visible: true },
      { $set: { visible: false, updatedBy: userId } },
      { new: true }
    ).lean();
  }
}

export const troubleshootGuideService = new TroubleshootGuideService();
