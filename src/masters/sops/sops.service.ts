import { SOPsModel, ISopsMaster } from '../../models/sops.model';
import { CategoryModel } from '../../models/formCategory.model';
import { InspectionModel } from '../../models/inspection.model';
import { LocationModel } from '../../models/location.model';
import { SchedulerModel } from '../../models/scheduleMaster.model';
import { WorkOrderModel } from '../../models/workOrder.model';
import { sanitizeSopPayload } from './sops.policy';

class SOPsService {

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
        const payload = sanitizeSopPayload(body);
        await this.assertReferences(payload, account_id);
        await this.assertUniqueName(payload, account_id);
        const newSchedule = new SOPsModel({ ...payload, account_id, createdBy: user_id });
        return await newSchedule.save();
    };

    async updateSOPs (id: any, body: any, account_id: any, user_id: any): Promise<ISopsMaster | null> {
        const existing = await SOPsModel.findOne({ _id: id, account_id, visible: true }).lean();
        if (!existing) return null;
        const payload = sanitizeSopPayload({
            name: body.name !== undefined ? body.name : existing.name,
            description: body.description !== undefined ? body.description : existing.description,
            locationId: body.locationId !== undefined ? body.locationId : existing.locationId,
            categoryId: body.categoryId !== undefined ? body.categoryId : existing.categoryId,
            json_temp: body.json_temp !== undefined ? body.json_temp : existing.json_temp
        });
        await this.assertReferences(payload, account_id);
        await this.assertUniqueName(payload, account_id, String(id));
        return await SOPsModel.findOneAndUpdate(
            { _id: id, account_id, visible: true },
            { $set: { ...payload, updatedBy: user_id } },
            { returnDocument: 'after', runValidators: true }
        );
    };

    async removeSOPs (id: any, account_id: any, user_id: any): Promise<any> {
        const [inspection, workOrder, schedule] = await Promise.all([
            InspectionModel.exists({ account_id, form_id: id, visible: true }),
            WorkOrderModel.exists({ account_id, sop_form_id: id, visible: true }),
            SchedulerModel.exists({ account_id, 'work_order.sop_form_id': id, visible: true })
        ]);
        if (inspection || workOrder || schedule) {
            throw Object.assign(new Error('Form is in use and cannot be deleted'), { status: 409 });
        }
        return await SOPsModel.findOneAndUpdate(
            { _id: id, account_id, visible: true },
            { $set: { visible: false, updatedBy: user_id } },
            { returnDocument: 'after' }
        );
    };

    private async assertReferences(payload: any, account_id: any): Promise<void> {
        const [location, category] = await Promise.all([
            LocationModel.exists({ _id: payload.locationId, account_id, visible: true }),
            CategoryModel.exists({ _id: payload.categoryId, account_id, visible: true })
        ]);
        if (!location) {
            throw Object.assign(new Error('Location is not available in this account'), { status: 400 });
        }
        if (!category) {
            throw Object.assign(new Error('Form category is not available in this account'), { status: 400 });
        }
    }

    private async assertUniqueName(payload: any, account_id: any, excludeId?: string): Promise<void> {
        const filter: any = {
            account_id,
            locationId: payload.locationId,
            categoryId: payload.categoryId,
            name: { $regex: `^${escapeRegExp(payload.name)}$`, $options: 'i' },
            visible: true
        };
        if (excludeId) filter._id = { $ne: excludeId };
        if (await SOPsModel.exists(filter)) {
            throw Object.assign(new Error('A form with this name already exists for the selected category and location'), { status: 409 });
        }
    }
}

export const sopsService = new SOPsService();

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
