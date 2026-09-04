import { SchedulerModel, IScheduleMaster } from "../models/scheduleMaster.model";
import { UserModel } from "../../users/models/user.model";
import { PartsTypeModel } from "../../inventory/models/parts-types.model";
import { helperService } from "../../../common/utils/object-id.helper";
import { AssetModel } from "../../assets/models/asset.model";
import { LocationModel } from "../../locations/models/location.model";

class ScheduleService {
    private normalizeSchedulePayload(body: any): any {
        const normalized = JSON.parse(JSON.stringify(body || {}));
        if (normalized?.work_order?.wo_asset_id === '') {
            normalized.work_order.wo_asset_id = null;
        }
        return normalized;
    }

    private toSetPayload(body: any): Record<string, any> {
        const updates: Record<string, any> = {};
        const visit = (value: any, prefix: string) => {
            if (Array.isArray(value) || value === null || typeof value !== 'object') {
                updates[prefix] = value;
                return;
            }
            for (const [key, nestedValue] of Object.entries(value)) {
                visit(nestedValue, prefix ? `${prefix}.${key}` : key);
            }
        };
        for (const [key, value] of Object.entries(body || {})) visit(value, key);
        return updates;
    }

    async getSchedules(match: any): Promise<IScheduleMaster[]> {
        match.visible = true;
        let data = await SchedulerModel.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: AssetModel.collection.name,
                    let: { assetId: "$work_order.wo_asset_id", accountId: "$account_id" },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ["$_id", "$$assetId"] }, { $eq: ["$account_id", "$$accountId"] }] }, visible: true } },
                        { $project: { _id: 1, id: "$_id", asset_name: 1, asset_type: 1, asset_model: 1, top_level: 1, parent_id: 1, visible: 1 } },
                    ],
                    as: "work_order.asset"
                }
            },
            { $unwind: { path: "$work_order.asset", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: LocationModel.collection.name,
                    let: { locId: "$work_order.wo_location_id", accountId: "$account_id" },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ["$_id", "$$locId"] }, { $eq: ["$account_id", "$$accountId"] }] }, visible: true } },
                        { $project: { _id: 1, id: "$_id", location_name: 1, location_type: 1, top_level: 1, parent_id: 1, visible: 1 } },
                    ],
                    as: "work_order.location"
                }
            },
            { $unwind: { path: "$work_order.location", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: UserModel.collection.name,
                    let: { userId: "$createdBy" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
                        { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, email: 1, username: 1, user_profile_img: 1, user_role: 1, user_status: 1 } },
                    ],
                    as: "createdBy"
                }
            },
            { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: UserModel.collection.name,
                    let: { userId: "$updatedBy" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
                        { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, email: 1, username: 1, user_profile_img: 1, user_role: 1, user_status: 1 } },
                    ],
                    as: "updatedBy"
                }
            },
            { $unwind: { path: "$updatedBy", preserveNullAndEmptyArrays: true } },
            { $addFields: { id: "$_id" } },
            { $sort: { _id: -1 } }
        ]);
        if (!data || data.length === 0) {
            return [];
        }
        const result = await Promise.all(
            data.map(async (item: any) => {
                if (item.work_order?.userIdList?.length) {
                    const validUserIds = item.work_order.userIdList.filter((id: string) => !!id);
                    const users = await UserModel.find({ _id: { $in: validUserIds }, account_id: item.account_id }).select("id firstName lastName username email user_role user_profile_img user_status").lean();
                    item.work_order.users = users;
                } else {
                    item.work_order.users = [];
                }

                if (item.work_order?.parts?.length) {
                    item.work_order.parts = await Promise.all(item.work_order.parts.map(async (part: any) => {
                        if (part.part_type && helperService.validateObjectId(part.part_type)) {
                            const partType = await PartsTypeModel.findOne({ _id: part.part_type, account_id: item.account_id, visible: true }).select("_id name description").lean();
                            if (partType) {
                                part.partTypeData = { ...partType, id: partType._id.toString() };
                            }
                        }
                        return part;
                    }));
                }
                return item;
            })
        );
        return result;
    };

    async createSchedules(body: any, account_id: any, user_id: any): Promise<IScheduleMaster | any> {
        const normalizedBody = this.normalizeSchedulePayload(body);
        normalizedBody.work_order = { ...(normalizedBody.work_order || {}), status: 'Open' };
        const newSchedule = new SchedulerModel({ ...normalizedBody, account_id, createdBy: user_id });
        const saved = await newSchedule.save();
        const data = await this.getSchedules({ _id: saved._id, account_id });
        return data[0];
    };

    async updateSchedules(id: any, body: any, account_id: any, user_id: any): Promise<IScheduleMaster | any> {
        const normalizedBody = this.normalizeSchedulePayload(body);
        const setPayload = this.toSetPayload(normalizedBody);
        setPayload.updatedBy = user_id;
        const updated = await SchedulerModel.findOneAndUpdate(
            { _id: id, account_id, visible: true },
            { $set: setPayload },
            { returnDocument: 'after', runValidators: true }
        );
        if (!updated) throw Object.assign(new Error('Schedule not found'), { status: 404 });
        const data = await this.getSchedules({ _id: helperService.validateObjectId(String(id)), account_id });
        return data[0];
    };

    async updateStatus(id: any, enabled: boolean, account_id: any, user_id: any): Promise<IScheduleMaster | any> {
        const updated = await SchedulerModel.findOneAndUpdate(
            { _id: id, account_id, visible: true },
            {
                $set: {
                    "schedule.enabled": enabled,
                    "updatedBy": user_id
                }
            },
            { returnDocument: 'after' }
        );
        if (!updated) throw Object.assign(new Error('Schedule not found'), { status: 404 });
        const data = await this.getSchedules({ _id: helperService.validateObjectId(String(id)), account_id });
        return data[0];
    };

    async removeSchedules(id: any, account_id: any, user_id: any): Promise<IScheduleMaster | null> {
        return await SchedulerModel.findOneAndUpdate(
            { _id: id, account_id, visible: true },
            { $set: { updatedBy: user_id, visible: false, 'schedule.enabled': false } },
            { returnDocument: 'after' }
        );
    };

    async assertScheduleReferences(body: any, account_id: any): Promise<void> {
        const workOrder = body?.work_order;
        if (!workOrder) return;

        if (workOrder.wo_location_id) {
            const location = await LocationModel.exists({ _id: workOrder.wo_location_id, account_id, visible: true });
            if (!location) throw Object.assign(new Error('Location does not belong to the active account'), { status: 400 });
        }

        if (workOrder.wo_asset_id) {
            const asset = await AssetModel.exists({ _id: workOrder.wo_asset_id, account_id, visible: true });
            if (!asset) throw Object.assign(new Error('Asset does not belong to the active account'), { status: 400 });
        }

        if (Array.isArray(workOrder.userIdList)) {
            const userIds: string[] = Array.from(new Set<string>(workOrder.userIdList.map(String).filter(Boolean)));
            const activeUsers = await UserModel.countDocuments({
                _id: { $in: userIds },
                account_id,
                user_status: 'active'
            });
            if (activeUsers !== userIds.length) {
                throw Object.assign(new Error('Every assigned user must be active and belong to the active account'), { status: 400 });
            }
            workOrder.userIdList = userIds;
        }
    }
}

export const scheduleService = new ScheduleService();
