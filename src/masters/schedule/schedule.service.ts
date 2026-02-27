import { SchedulerModel, IScheduleMaster } from "../../models/scheduleMaster.model";
import { UserModel } from "../../models/user.model";

class ScheduleService {

    async getSchedules(match: any): Promise<IScheduleMaster[]> {
        match.visible = true;
        let data = await SchedulerModel.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: "asset_master",
                    let: { assetId: "$work_order.wo_asset_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$assetId"] }, visible: true } },
                        { $project: { _id: 1, id: "$_id", asset_name: 1, asset_type: 1 } },
                    ],
                    as: "work_order.asset"
                }
            },
            { $unwind: { path: "$work_order.asset", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "location_master",
                    let: { locId: "$work_order.wo_location_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$locId"] }, visible: true } },
                        { $project: { _id: 1, id: "$_id", location_name: 1, location_type: 1 } },
                    ],
                    as: "work_order.location"
                }
            },
            { $unwind: { path: "$work_order.location", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    let: { userId: "$createdBy" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
                        { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, email: 1, user_profile_img: 1, user_role: 1 } },
                    ],
                    as: "createdBy"
                }
            },
            { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    let: { userId: "$updatedBy" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
                        { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, email: 1, user_profile_img: 1, user_role: 1 } },
                    ],
                    as: "updatedBy"
                }
            },
            { $unwind: { path: "$updatedBy", preserveNullAndEmptyArrays: true } },
            { $addFields: { id: "$_id" } },
            { $sort: { _id: -1 } }
        ]);
        if (!data || data.length === 0) {
            throw Object.assign(new Error("No data found"), { status: 404 });
        }
        const result = await Promise.all(
            data.map(async (item: any) => {
                if (item.work_order?.userIdList?.length) {
                    const validUserIds = item.work_order.userIdList.filter((id: string) => !!id);
                    const users = await UserModel.find({ _id: { $in: validUserIds } }).select("id firstName lastName username user_profile_img").lean();
                    item.work_order.users = users;
                } else {
                    item.work_order.users = [];
                }
                return item;
            })
        );
        return result;
    };

    async createSchedules(body: any, account_id: any, user_id: any): Promise<IScheduleMaster> {
        const newSchedule = new SchedulerModel({ ...body, account_id, createdBy: user_id });
        return await newSchedule.save();
    };

    async updateSchedules(id: any, body: any, user_id: any): Promise<IScheduleMaster | null> {
        return await SchedulerModel.findByIdAndUpdate(id, { ...body, updatedBy: user_id }, { new: true });
    };

    async removeSchedules(id: any, user_id: any): Promise<IScheduleMaster | null> {
        return await SchedulerModel.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { new: true });
    };
}

export const scheduleService = new ScheduleService();