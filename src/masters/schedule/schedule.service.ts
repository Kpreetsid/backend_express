import { ScheduleMasterModel, IScheduleMaster } from "../../models/scheduleMaster.model";

export const getSchedules = async (match: any): Promise<IScheduleMaster[]> => {
    match.visible = true;
    return await ScheduleMasterModel.find(match);
};

export const createSchedules = async (body:any, account_id: any, user_id: any): Promise<IScheduleMaster> => {
    const newSchedule = new ScheduleMasterModel({ ...body, account_id, createdBy: user_id });
    return await newSchedule.save();
};

export const updateSchedules = async (id: any, body: any, user_id: any): Promise<IScheduleMaster | null> => {
    return await ScheduleMasterModel.findByIdAndUpdate(id, { ...body, updatedBy: user_id }, { new: true });
};

export const removeSchedules = async (id: any, user_id: any): Promise<IScheduleMaster | null> => {
    return await ScheduleMasterModel.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { new: true });
};