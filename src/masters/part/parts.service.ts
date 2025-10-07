import mongoose from "mongoose";
import { PartsModel, IPart } from "../../models/part.model";

export const getAll = async (match: any): Promise<IPart[]> => {
  match.visible = true;
  return await PartsModel.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "location_master",
        let: { location_id: "$location_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$location_id"] } } },
          { $project: { _id: 1, location_name: 1, location_type: 1 } },
          { $addFields: { id: "$_id" } }
        ],
        as: "location"
      }
    },
    { $unwind: { path: "$location", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users",
        let: { user_id: "$createdBy" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$user_id"] } } },
          { $project: { _id: 1, firstName: 1, lastName: 1, user_role: 1 } },
          { $addFields: { id: "$_id" } }
        ],
        as: "user"
      }
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    { $addFields: { id: "$_id" } }
  ]);
};

export const insert = async (body: IPart, account_id: any, user_id: any): Promise<IPart> => {
  return await new PartsModel({
    account_id: account_id,
    part_name: body.part_name,
    part_number: body.part_number,
    part_type: body.part_type,
    unit: body.unit,
    description: body.description,
    quantity: body.quantity,
    min_quantity: body.min_quantity,
    cost: body.cost,
    location_id: body.location_id,
    createdBy: user_id
  }).save();
};

export const updatePartById = async (id: string, body: IPart, user_id: any) => {
  body.updatedBy = user_id;
  return await PartsModel.findByIdAndUpdate(id, body, { new: true });
};

export const removeById = async (id: string, user_id: any) => {
  return await PartsModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { new: true });
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