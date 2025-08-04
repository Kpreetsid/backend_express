import { SopsMasterModel, ISopsMaster } from '../../models/sops.model';

export const getSOPs = async (match: any): Promise<ISopsMaster[]> => {
    match.visible = true;
    const populateList = [{ path: 'account_id', select: '' }, { path: 'locationId', select: '' }, { path: 'categoryId', select: '' }];
    let data = await SopsMasterModel.find(match).populate(populateList);
    if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    data = data.map((doc: any) => {
      doc.account = doc.account_id;
      doc.account_id = doc.account_id._id;
      doc.location = doc.locationId;
      doc.locationId = doc.locationId._id;
      doc.category = doc.categoryId;
      doc.categoryId = doc.categoryId._id;
      return doc;
    });
    return data;
};

export const createSOPs = async (body: any, account_id: any, user_id: any): Promise<ISopsMaster> => {
    const newSchedule = new SopsMasterModel({ ...body, account_id, createdBy: user_id });
    return await newSchedule.save();
};

export const updateSOPs = async (id: any, body: any, user_id: any): Promise<ISopsMaster | null> => {
    body.updatedBy = user_id;
    return await SopsMasterModel.findByIdAndUpdate(id, body);
};

export const removeSOPs = async (id: any, user_id: any): Promise<any> => {
    return await SopsMasterModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { new: true });
};