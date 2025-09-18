import mongoose from "mongoose";
import { PartsModel, IPart } from "../../models/part.model";

export const getAll = async (match: any): Promise<IPart[]> => {
  match.visible = true;
  return await PartsModel.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "location_master",
        let: { locId: "$locationId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$locId"] } } },
          { $project: { _id: 1, location_name: 1, location_type: 1 } }
        ],
        as: "location"
      }
    },
    { $unwind: { path: "$location", preserveNullAndEmptyArrays: true } },
    { $addFields: { id: "$_id" } }
  ]);
};

export const insert = async (body: IPart, account_id: any, user_id: any): Promise<IPart> => {
  body.createdBy = user_id;
  body.account_id = account_id;
  return await new PartsModel(body).save();
};

export const updatePartById = async (id: string, body: IPart, userID: any) => {
  body.updatedBy = userID;
  return await PartsModel.findByIdAndUpdate(id, body, { new: true });
};

export const removeById = async (id: string, userID: any) => {
  return await PartsModel.findByIdAndUpdate(id, { visible: false, updatedBy: userID }, { new: true });
};

export const assignPartToWorkOrder = async (body: any, user: any) => {
  const { estimated } = body;
  await Promise.all(
    estimated.map(async (doc: any) => {
      doc.part_id = new mongoose.Types.ObjectId(doc.part_id);
      const data = await PartsModel.findOne({ _id: doc.part_id });
      if (!data) return;
      data.quantity = data.quantity - doc.quantity;
      data.updatedBy = user._id;
      await data.save();
    })
  );
  return true;
};

export const revertPartFromWorkOrder = async (body: any, user: any) => {
  const { estimated = [], actual = [] } = body;
  const actualMap = new Map();
  actual.forEach((a: any) => {
    const id = a.part_id.toString();
    if (!actualMap.has(id)) {
      actualMap.set(id, 0);
    }
    actualMap.set(id, actualMap.get(id) + a.quantity);
  });

  await Promise.all(
    estimated.map(async (doc: any) => {
      if (!doc?.part_id || !doc?.quantity) return;
      const data = await PartsModel.findOne({ _id: new mongoose.Types.ObjectId(doc.part_id) });
      if (!data) return;
      const assignedQty = doc.quantity;
      const actualQty = actualMap.get(doc.part_id.toString()) || 0;
      data.quantity = data.quantity + assignedQty - actualQty;
      data.updatedBy = user._id;
      await data.save();
    })
  );
  return true;
};