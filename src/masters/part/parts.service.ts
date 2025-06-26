import { Part, IPart } from "../../models/part.model";
import { IUser } from "../../models/user.model";

export const getAll = async (match: any): Promise<IPart[]> => {
  return await Part.find(match);
};

export const insert = async (body: IPart, user: IUser): Promise<IPart> => {
  body.createdBy = user.id;
  body.account_id = user.account_id;
  return await new Part(body).save();
};

export const updateById = async (id: string, body: IPart, userID: any) => {
  body.updatedBy = userID;
  return await Part.findByIdAndUpdate(id, body, { new: true });
};

export const removeById = async (id: string, userID: any) => {
  return await Part.findByIdAndUpdate(id, { visible: false, updatedBy: userID }, { new: true });
};