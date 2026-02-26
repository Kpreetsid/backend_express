import { SOPsModel, ISopsMaster } from '../../models/sops.model';

class SOPsService {

    async getSOPs (match: any): Promise<ISopsMaster[]> {
        match.visible = true;
        const populateList = [
            { path: 'account_id', model: "Schema_Account", match: { visible: true }, select: 'id account_name' },
            { path: 'locationId', model: "Schema_Location", match: { visible: true }, select: 'id location_name location_type' },
            { path: 'categoryId', model: "Schema_Category", match: { visible: true }, select: 'id name' },
            { path: 'createdBy', model: "Schema_User", match: { visible: true }, select: 'id firstName lastName' },
            { path: 'updatedBy', model: "Schema_User", match: { visible: true }, select: 'id firstName lastName' }
        ];
        return await SOPsModel.find(match).populate(populateList).sort({ _id: -1 });
    };

    async createSOPs (body: any, account_id: any, user_id: any): Promise<ISopsMaster> {
        const newSchedule = new SOPsModel({ ...body, account_id, createdBy: user_id });
        return await newSchedule.save();
    };

    async updateSOPs (id: any, body: any, user_id: any): Promise<ISopsMaster | null> {
        body.updatedBy = user_id;
        return await SOPsModel.findByIdAndUpdate(id, body);
    };

    async removeSOPs (id: any, user_id: any): Promise<any> {
        return await SOPsModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { new: true });
    };
}

export const sopsService = new SOPsService();