import { TroubleshootGuideModel } from "../../models/troubleshootGuide.model";

class TroubleshootGuideService {
    private sanitizeBody(body: any): Record<string, unknown> {
        const source = body || {};
        return {
            title: source.title,
            description: source.description,
            tags: source.tags,
            type: source.type,
            troubleshooting_steps: source.troubleshooting_steps,
            ...(source.assetId ? { assetId: source.assetId } : {}),
            ...(source.locationId ? { locationId: source.locationId } : {})
        };
    }

    async getAllTroubleshootGuide (match: any): Promise<any> {
        match.visible = true;
        const populateList = [
            { path: 'locationId', model: 'Schema_Location', select: 'id location_name location_type top_level parent_id visible', match: { visible: true } },
            { path: 'assetId', model: 'Schema_Asset', select: 'id asset_name asset_type asset_model top_level parent_id visible', match: { visible: true } }
        ];
        return await TroubleshootGuideModel.find(match).populate(populateList).sort({ _id: -1 });
    };
    
    async insertTroubleshootGuide (body: any, account_id: any, user_id: any): Promise<any> {
        const newGuide = new TroubleshootGuideModel({
            ...this.sanitizeBody(body),
            account_id: account_id,
            createdBy: user_id
        });
        return await newGuide.save();
    };
    
    async updateTroubleshootGuideById (id: any, body: any, account_id: any, user_id: any): Promise<any> {
        return await TroubleshootGuideModel.findOneAndUpdate(
            { _id: id, account_id, visible: true },
            { ...this.sanitizeBody(body), updatedBy: user_id },
            { returnDocument: 'after' }
        );
    };
    
    async removeTroubleshootGuideById (id: any, account_id: any, user_id: any): Promise<any> {
        return await TroubleshootGuideModel.findOneAndUpdate(
            { _id: id, account_id, visible: true },
            { visible: false, updatedBy: user_id },
            { returnDocument: 'after' }
        );
    };
}

export const troubleshootGuideService = new TroubleshootGuideService();
