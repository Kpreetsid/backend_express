import { ObservationModel } from "../../models/observation.model";

export const getAllObservation = async (match: any): Promise<any> => {
  return await ObservationModel.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "users",
        let: { userId: "$userId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
          { $project: { _id: 1, firstName: 1, lastName: 1, user_role: 1 } },
          { $addFields: { id: "$_id" } }
        ],
        as: "user"
      }
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    { $sort: { createdAt: -1 } },
    { $addFields: { id: "$_id" } }
  ]);
};

export const insertObservation = async (body: any, account_id: any, user_id: any): Promise<any> => {
  const newObservation = new ObservationModel({ accountId: account_id, ...body, userId: user_id, createdBy: user_id });
  return await newObservation.save();
};

export const updateObservationById = async (id: string, body: any, user_id: any): Promise<any> => {
  return await ObservationModel.findByIdAndUpdate(id, { ...body, updatedBy: user_id }, { new: true });
};

export const removeObservationById = async (id: string, user_id: any): Promise<any> => {
  return await ObservationModel.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { new: true });
};