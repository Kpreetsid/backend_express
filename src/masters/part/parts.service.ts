import mongoose from "mongoose";
import { PartsModel, IPart } from "../../models/part.model";

interface InventoryAdjustmentResult {
  warnings: {
    part_id: any;
    part_name: string;
    quantity: number;
    min_quantity: number;
  }[];
}

class PartsService {

  async getAllParts(match: any): Promise<IPart[]> {
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
          as: "createdUser"
        }
      },
      { $unwind: { path: "$createdUser", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          let: { user_id: "$updatedBy" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$user_id"] } } },
            { $project: { _id: 1, firstName: 1, lastName: 1, user_role: 1 } },
            { $addFields: { id: "$_id" } }
          ],
          as: "updatedUser"
        }
      },
      { $unwind: { path: "$updatedUser", preserveNullAndEmptyArrays: true } },
      { $addFields: { id: "$_id" } },
      { $sort: { _id: -1 } }
    ]);
  };

  async insert(body: IPart, account_id: any, user_id: any): Promise<IPart> {
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

  async updatePartById(id: string, body: IPart, user_id: any) {
    body.updatedBy = user_id;
    return await PartsModel.findByIdAndUpdate(id, body, { new: true });
  };

  async updatePartStock(id: string, body: any, user_id: any) {
    body.updatedBy = user_id;
    return await PartsModel.findByIdAndUpdate(id, body, { new: true });
  }

  async removeById(id: string, user_id: any) {
    return await PartsModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { new: true });
  };

  async assignPartToWorkOrder(body: any, user: any) {
    await Promise.all(
      body.map(async (doc: any) => {
        const data = await PartsModel.findOne({ _id: new mongoose.Types.ObjectId(doc.part_id) });
        if (!data) return;
        data.quantity = data.quantity - doc.estimatedQuantity;
        data.updatedBy = user._id;
        await data.save();
      })
    );
    return true;
  };

  async revertPartFromWorkOrder(oldParts: any, newParts: any, user: any) {
    const oldMap = new Map();
    const newMap = new Map();
    oldParts.forEach((p: any) => oldMap.set(String(p.part_id), Number(p.estimatedQuantity)));
    newParts.forEach((p: any) => newMap.set(String(p.part_id), Number(p.estimatedQuantity)));
    const allPartIds = Array.from(new Set([...oldMap.keys(), ...newMap.keys()]));
    for (const partId of allPartIds) {
      const oldQty = oldMap.get(partId) || 0;
      const newQty = newMap.get(partId) || 0;
      if (oldQty === newQty) continue;
      const part = await PartsModel.findById(partId);
      if (!part) continue;
      if (oldQty > 0 && newQty === 0) {
        part.quantity += oldQty;
      }
      if (oldQty === 0 && newQty > 0) {
        if (part.quantity < newQty) {
          throw Object.assign(new Error(`Not enough quantity for ${part.part_name}`), { status: 400 });
        }
        part.quantity -= newQty;
      }
      if (oldQty > newQty) {
        const diff = oldQty - newQty;
        part.quantity += diff;
      }
      if (newQty > oldQty) {
        const diff = newQty - oldQty;
        if (part.quantity < diff) {
          throw Object.assign(new Error(`Insufficient inventory for ${part.part_name}`), { status: 400 });
        }
        part.quantity -= diff;
      }
      part.updatedBy = user._id;
      await part.save();
    }
  };

  async adjustInventoryByWorkOrder(oldParts: any[] = [], newParts: any[] = [], user: any): Promise<InventoryAdjustmentResult> {
    const oldMap = new Map<string, number>();
    const newMap = new Map<string, number>();
    const warnings: InventoryAdjustmentResult["warnings"] = [];

    oldParts.forEach(p => oldMap.set(String(p.part_id), Number(p.estimatedQuantity)));
    newParts.forEach(p => newMap.set(String(p.part_id), Number(p.estimatedQuantity)));

    const allPartIds = [...new Set([...oldMap.keys(), ...newMap.keys()])];

    for (const partId of allPartIds) {
      const oldQty = oldMap.get(partId) || 0;
      const newQty = newMap.get(partId) || 0;
      const diff = newQty - oldQty;

      if (diff === 0) continue;

      const part = await PartsModel.findById(partId);
      if (!part) continue;

      if (diff > 0 && part.quantity < diff) {
        throw Object.assign(new Error(`Insufficient stock for ${part.part_name}`), { status: 400 });
      }

      part.quantity -= diff;
      part.updatedBy = user._id;

      await part.save();

      if (part.quantity <= part.min_quantity) {
        warnings.push({
          part_id: part._id,
          part_name: part.part_name,
          quantity: part.quantity,
          min_quantity: part.min_quantity
        });
      }
    }
    return { warnings };
  }
}

export const partsService = new PartsService();