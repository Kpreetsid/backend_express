import { SOPsModel, ISopsMaster } from '../../models/sops.model';
import { LocationModel } from '../../models/location.model';
import { CategoryModel } from '../../models/formCategory.model';

class SOPsService {

    private editableFields(body: any): Record<string, any> {
        const fields = ['name', 'description', 'locationId', 'categoryId', 'json_temp'];
        return Object.fromEntries(fields.filter(key => Object.prototype.hasOwnProperty.call(body || {}, key)).map(key => [key, body[key]]));
    }

    private async validateReferences(body: any, account_id: any): Promise<void> {
        if (!account_id) throw Object.assign(new Error('Authenticated account is required'), { status: 403 });
        for (const [field, model] of [['locationId', LocationModel], ['categoryId', CategoryModel]] as const) {
            if (body[field] === undefined) continue;
            if (!await (model as any).exists({ _id: body[field], account_id, visible: true })) {
                throw Object.assign(new Error('Referenced form object is unavailable or outside your account'), { status: 403 });
            }
        }
    }

    async getSOPs (match: any): Promise<ISopsMaster[]> {
        match.visible = true;
        const populateList = [
            { path: 'account_id', model: "Schema_Account", select: 'id account_name' },
            { path: 'locationId', model: "Schema_Location", select: 'id location_name location_type top_level parent_id visible', match: { visible: true } },
            { path: 'categoryId', model: "Schema_Category", select: 'id name', match: { visible: true } },
            { path: 'createdBy', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status' },
            { path: 'updatedBy', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status' }
        ];
        return await SOPsModel.find(match).populate(populateList).sort({ _id: -1 });
    };

    async createSOPs (body: any, account_id: any, user_id: any): Promise<ISopsMaster> {
        const fields = this.editableFields(body);
        await this.validateReferences(fields, account_id);
        const newSchedule = new SOPsModel({ ...fields, account_id, createdBy: user_id, visible: true });
        return await newSchedule.save();
    };

    async updateSOPs (id: any, body: any, user_id: any, account_id: any): Promise<ISopsMaster | null> {
        const fields = this.editableFields(body);
        await this.validateReferences(fields, account_id);
        return await SOPsModel.findOneAndUpdate({ _id: id, account_id, visible: true },
            { $set: { ...fields, updatedBy: user_id } }, { returnDocument: 'after', runValidators: true });
    };

    async removeSOPs (id: any, user_id: any, account_id: any): Promise<any> {
        if (!account_id) throw Object.assign(new Error('Authenticated account is required'), { status: 403 });
        return await SOPsModel.findOneAndUpdate({ _id: id, account_id, visible: true },
            { $set: { visible: false, updatedBy: user_id } }, { returnDocument: 'after' });
    };
}

export const sopsService = new SOPsService();
