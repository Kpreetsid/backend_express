import { SOPsModel, ISopsMaster } from '../../models/sops.model';

export const getSOPs = async (match: any): Promise<ISopsMaster[]> => {
    match.visible = true;
    const populateList = [
        { path: 'account_id', model: "Schema_Account", select: 'id account_name' },
        { path: 'locationId', model: "Schema_Location", select: 'id location_name location_type' },
        { path: 'categoryId', model: "Schema_Category", select: 'id name' },
        { path: 'createdBy', model: "Schema_User", select: 'id firstName lastName' },
        { path: 'updatedBy', model: "Schema_User", select: 'id firstName lastName' }
    ];
    let data = await SOPsModel.find(match).populate(populateList);
    if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return data;
};

export const createSOPs = async (body: any, account_id: any, user_id: any): Promise<ISopsMaster> => {
    const newSchedule = new SOPsModel({ ...body, account_id, createdBy: user_id });
    return await newSchedule.save();
};

export const updateSOPs = async (id: any, body: any, user_id: any): Promise<ISopsMaster | null> => {
    body.updatedBy = user_id;
    return await SOPsModel.findByIdAndUpdate(id, body);
};

export const removeSOPs = async (id: any, user_id: any): Promise<any> => {
    return await SOPsModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { new: true });
};