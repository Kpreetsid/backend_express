import { Part, IPart } from "../../models/part.model";

export const getAll = async (match: any): Promise<IPart[]> => {
  match.isActive = true;
  return await Part.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "location_master",
        let: { locId: "$locationId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$locId"] } } },
          { $project: { _id: 1, location_name: 1 } }
        ],
        as: "location"
      }
    },
    { $unwind: { path: "$location", preserveNullAndEmptyArrays: true } }
  ]);
};

export const insert = async (body: IPart, account_id: any, user_id: any): Promise<IPart> => {
  body.createdBy = user_id;
  body.account_id = account_id;
  return await new Part(body).save();
};

export const updateById = async (id: string, body: IPart, userID: any) => {
  body.updatedBy = userID;
  return await Part.findByIdAndUpdate(id, body, { new: true });
};

export const removeById = async (id: string, userID: any) => {
  return await Part.findByIdAndUpdate(id, { visible: false, updatedBy: userID }, { new: true });
};