import { SchedulerModel, IScheduleMaster } from "../../models/scheduleMaster.model";
import { UserModel } from "../../models/user.model";
import { PartsTypeModel } from "../../models/parts-types.model";
import { helperService } from "../../utils/helper";
import { AssetModel } from "../../models/asset.model";
import { LocationModel } from "../../models/location.model";
import mongoose from "mongoose";

class ScheduleService {
    private normalizeSchedulePayload(body: any): any {
        const normalized = JSON.parse(JSON.stringify(body || {}));
        if (normalized?.work_order?.wo_asset_id === '') {
            normalized.work_order.wo_asset_id = null;
        }
        return normalized;
    }

    async getSchedules(match: any): Promise<IScheduleMaster[]> {
        match.visible = true;
        let data = await SchedulerModel.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: AssetModel.collection.name,
                    let: { assetId: "$work_order.wo_asset_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$assetId"] }, visible: true } },
                        { $project: { _id: 1, id: "$_id", asset_name: 1, asset_type: 1, asset_model: 1, top_level: 1, parent_id: 1, visible: 1 } },
                    ],
                    as: "work_order.asset"
                }
            },
            { $unwind: { path: "$work_order.asset", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: LocationModel.collection.name,
                    let: { locId: "$work_order.wo_location_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$locId"] }, visible: true } },
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
            throw Object.assign(new Error("No records found"), { status: 404 });
        }
        const result = await Promise.all(
            data.map(async (item: any) => {
                if (item.work_order?.userIdList?.length) {
                    const validUserIds = item.work_order.userIdList.filter((id: string) => !!id);
                    const users = await UserModel.find({ _id: { $in: validUserIds } }).select("id firstName lastName username email user_role user_profile_img user_status").lean();
                    item.work_order.users = users;
                } else {
                    item.work_order.users = [];
                }

                if (item.work_order?.parts?.length) {
                    item.work_order.parts = await Promise.all(item.work_order.parts.map(async (part: any) => {
                        if (part.part_type && mongoose.Types.ObjectId.isValid(part.part_type)) {
                            const partType = await PartsTypeModel.findOne({ _id: part.part_type, visible: true }).select("_id name description").lean();
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
        const newSchedule = new SchedulerModel({ ...normalizedBody, account_id, createdBy: user_id });
        const saved = await newSchedule.save();
        const data = await this.getSchedules({ _id: saved._id });
        return data[0];
    };

    async updateSchedules(id: any, body: any, account_id: any, user_id: any): Promise<IScheduleMaster | any> {
        const normalizedBody = this.normalizeSchedulePayload(body);
        const scheduleId = helperService.validateObjectId(String(id));
        const updated = await SchedulerModel.findOneAndUpdate(
            { _id: scheduleId, account_id, visible: true },
            { ...normalizedBody, updatedBy: user_id },
            { returnDocument: 'after' }
        );
        if (!updated) {
            throw Object.assign(new Error('Schedule not found'), { status: 404 });
        }
        const data = await this.getSchedules({ _id: scheduleId, account_id, visible: true });
        return data[0];
    };

    async removeSchedules(id: any, account_id: any, user_id: any): Promise<IScheduleMaster | null> {
        return await SchedulerModel.findOneAndUpdate(
            { _id: helperService.validateObjectId(String(id)), account_id, visible: true },
            { updatedBy: user_id, visible: false },
            { returnDocument: 'after' }
        );
    };
}

export const scheduleService = new ScheduleService();
