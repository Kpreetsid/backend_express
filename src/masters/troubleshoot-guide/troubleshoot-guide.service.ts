import { TroubleshootGuideModel } from "../../models/troubleshootGuide.model";

class TroubleshootGuideService {
    async getAllTroubleshootGuide (match: any): Promise<any> {
        match.visible = true;
        const populateList = [
            { path: 'locationId', model: 'Schema_Location', select: 'id location_name', match: { visible: true } },
            { path: 'assetId', model: 'Schema_Asset', select: 'id asset_name', match: { visible: true } }
        ];
        return await TroubleshootGuideModel.find(match).populate(populateList).sort({ _id: -1 });
    };
    
    async insertTroubleshootGuide (body: any, account_id: any, user_id: any): Promise<any> {
        const newTeam = new TroubleshootGuideModel({
            ...body,
            account_id: account_id,
            createdBy: user_id
        });
        return await newTeam.save();
    };
    
    async updateTroubleshootGuideById (id: any, body: any, user_id: any): Promise<any> {
        return await TroubleshootGuideModel.findByIdAndUpdate(id, { ...body, updatedBy: user_id }, { new: true });
    };
    
    async removeTroubleshootGuideById (id: any, user_id: any): Promise<any> {
        return await TroubleshootGuideModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { new: true });
    };
}

export const troubleshootGuideService = new TroubleshootGuideService();