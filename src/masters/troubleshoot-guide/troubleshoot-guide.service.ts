import { TroubleshootGuideModel } from "../../models/troubleshootGuide.model";

export const getAllTroubleshootGuide = async (match: any): Promise<any> => {
    return await TroubleshootGuideModel.find(match).sort({ _id: -1 });
};

export const insertTroubleshootGuide = async (body: any, account_id: any, user_id: any): Promise<any> => {
    const newTeam = new TroubleshootGuideModel({
        ...body,
        account_id: account_id,
        createdBy: user_id
    });
    return await newTeam.save();
};

export const updateTroubleshootGuideById = async (id: any, body: any, user_id: any): Promise<any> => {
    return await TroubleshootGuideModel.findByIdAndUpdate(id, { ...body, updatedBy: user_id }, { new: true });
};

export const removeTroubleshootGuideById = async (id: any, user_id: any): Promise<any> => {
    return await TroubleshootGuideModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { new: true });
};