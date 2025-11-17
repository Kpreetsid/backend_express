import { IWorkOrder, WorkOrderModel } from "../../models/workOrder.model";
import { IUser, UserModel } from "../../models/user.model";
import { sendWorkOrderMail } from "../../_config/mailer";
import { mapUsersWorkOrder, removeMappedUsers, updateMappedUsers } from "../../transaction/mapUserWorkOrder/userWorkOrder.service";
import { assignPartToWorkOrder, revertPartFromWorkOrder } from "../../masters/part/parts.service";
import { getAllCommentsForWorkOrder } from "../comments/comment.service";
import mongoose from "mongoose";

export const getAllOrders = async (match: any): Promise<any> => {
  let data = await WorkOrderModel.aggregate([
    { $match: match },
    { $lookup: { from: "wo_user_mapping", localField: "_id", foreignField: "woId", as: "assignedUsers" }},
    { $lookup: { 
      from: "asset_master", 
      let: { wo_asset_id: '$wo_asset_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$wo_asset_id'] } } },
        { $project: { _id: 1, asset_name: 1, asset_type: 1 } },
        { $addFields: { id: '$_id' } }
      ],
      as: "asset" 
    }},
    { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true }},
    { $lookup: { 
      from: "location_master", 
      let: { wo_location_id: '$wo_location_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$wo_location_id'] } } },
        { $project: { _id: 1, location_name: 1, location_type: 1 } },
        { $addFields: { id: '$_id' } }
      ],
      as: "location" 
    }},
    { $unwind: { path: "$location", preserveNullAndEmptyArrays: true }},
    { $lookup: { 
      from: "users", 
      let: { createdBy: '$createdBy' },
      pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$createdBy'] } } },
        { $project: { _id: 1, firstName: 1, lastName: 1, user_role: 1 } },
        { $addFields: { id: '$_id' } }
      ],
      as: "createdBy" 
    }},
    { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true }},
    { $lookup: {
      from: "users",
      let: { updatedBy: '$updatedBy' },
      pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$updatedBy'] } } },
        { $project: { _id: 1, firstName: 1, lastName: 1, user_role: 1 } },
        { $addFields: { id: '$_id' } }
      ],
      as: "updatedBy"
    }},
    { $unwind: { path: "$updatedBy", preserveNullAndEmptyArrays: true }},
    { $addFields: { id: "$_id" }}
  ]);
  if (!data || data.length === 0) {
    throw Object.assign(new Error('No data found'), { status: 404 });
  }
  const result = await Promise.all(data.map(async (item: any) => {
    item.assignedUsers = await Promise.all(item.assignedUsers.map(async (mapItem: any) => {
      const user = await UserModel.find({ _id: mapItem.userId }).select('id firstName lastName username user_profile_img');
      mapItem.user = user.length > 0 ? user[0] : {};
      mapItem.id = mapItem._id;
      return mapItem;
    }));
    item.comments = await getAllCommentsForWorkOrder({ work_order_id: item._id });
    return item;
  }));
  return result;
};

export const orderStatus = async (match: any): Promise<any> => {
  const data = await WorkOrderModel.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { _id: 0, key: '$_id', value: '$count' } }
  ]);
  if (data.length === 0) {
    throw Object.assign(new Error('No data found'), { status: 404 });
  }
  const statuses = ['Open', 'On-Hold', 'In-Progress', 'Completed'];
  const result = statuses.map((status) => {
    const found: any = data.find((d: any) => d.key === status);
    return { key: status, value: found ? found.value : 0 };
  });
  return result;
};

export const orderPriority = async (match: any): Promise<any> => {
  match.visible = true;
  const data: IWorkOrder[] = await WorkOrderModel.aggregate([
    { $match: match },
    { $group: { _id: '$priority', count: { $sum: 1 } } },
    { $project: { _id: 0, key: '$_id', value: '$count' } }
  ]);
  if (data.length === 0) {
    throw Object.assign(new Error('No data found'), { status: 404 });
  }
  let priorityLevels = ['High', 'Medium', 'Low', 'None'];
  let result = priorityLevels.map((level: any) => {
    const found: any = data.find((d: any) => d.key === level);
    return { key: level, value: found ? found.value : 0 };
  });
  return result;
};

export const monthlyCount = async (match: any): Promise<any> => {
  match.visible = true;
  const data: IWorkOrder[] = await WorkOrderModel.find(match)
  if (data.length === 0) {
    throw Object.assign(new Error('No data found'), { status: 404 });
  }
  var monthlyCountArray: any = [];
  const monthlyCounts: any = {}
  data.forEach((item: any) => {
    const yearMonth = item._id.getTimestamp().toISOString().substr(0, 7);
    if (!monthlyCounts[yearMonth]) {
      monthlyCounts[yearMonth] = 0;
    }
    monthlyCounts[yearMonth]++;
    monthlyCountArray = Object.entries(monthlyCounts).map(([yearMonth, count]) => ({ id: yearMonth, count }));
  });
  return monthlyCountArray;
};

export const plannedUnplanned = async (match: any): Promise<any> => {
  const data: any = await WorkOrderModel.find(match).select('_id createdAt createdFrom').lean();
  if (!data || data.length === 0) {
    throw Object.assign(new Error('No data found'), { status: 404 });
  }
  const grouped = data.reduce((acc: Record<string, any>, doc: any) => {
    const monthYear = new Date(doc.createdAt).toISOString().slice(0, 7);
    const key = `${doc.createdFrom}-${monthYear}`;
    if (!acc[key]) acc[key] = { createdFrom: doc.createdFrom || 'Work Order', monthYear, count: 0 };
    acc[key].count++;
    return acc;
  }, {});
  const aggregated = Object.values(grouped) as { createdFrom: string; monthYear: string; count: number }[];
  const groupedByCreatedFrom: Record<string, { monthYear: string; count: number }[]> = {};
  for (const item of aggregated) {
    if (!groupedByCreatedFrom[item.createdFrom]) groupedByCreatedFrom[item.createdFrom] = [];
    groupedByCreatedFrom[item.createdFrom].push({ monthYear: item.monthYear, count: item.count });
  }
  const months = [...new Set(aggregated.map(a => a.monthYear))].sort();
  const categories = ['Work Order', 'Preventive'];
  const final_result: any = { date: months, 'Work Order': [], 'Preventive': [] };
  const allCreatedFrom = Object.keys(groupedByCreatedFrom);
  for (const cf of allCreatedFrom) {
    const counts = months.map(month => {
      const found = groupedByCreatedFrom[cf].find(c => c.monthYear === month);
      return found ? found.count : 0;
    });
    final_result[cf] = counts;
  }
  for (const cat of categories) {
    if (!final_result[cat]?.length) {
      final_result[cat] = months.map(() => 0);
    }
  }
  return final_result;
};

export const summaryData = async (workOrderMatch: any): Promise<any> => {
  try {
    const workOrders: any = await WorkOrderModel.find(workOrderMatch).lean();
    const today = new Date();
    const completedOnTime: any[] = [];
    const overdueWO: any[] = [];
    const plannedWO: any[] = [];
    const unplannedWO: any[] = [];
    const workRequests: any[] = [];
    for (const item of workOrders) {
      const { status, end_date, updatedAt, createdFrom } = item;
      const endDate = new Date(end_date);
      const completedOn = updatedAt ? new Date(updatedAt) : null;
      if (status === 'Completed' && completedOn && completedOn <= endDate) {
        completedOnTime.push(item);
      }
      if (status !== 'Completed' && endDate < today) {
        overdueWO.push(item);
      }
      const origin = (createdFrom || '').toLowerCase();
      if (origin === 'preventive') {
        plannedWO.push(item);
      } else if (['work order', 'work request'].includes(origin)) {
        unplannedWO.push(item);
      }
      if (item.work_request_id) {
        workRequests.push(item.work_request_id);
      }
    }
    const totalWO = workOrders.length;
    const plannedUnplannedRatio = totalWO ? (plannedWO.length / (plannedWO.length + unplannedWO.length)) * 100 : 0;
    const completionRate = totalWO ? (completedOnTime.length / totalWO) * 100 : 0;
    return { completion_rate: Number(completionRate.toFixed(2)), overdue_WO: overdueWO.length, work_request_count: workRequests.length, planned_unplanned_ratio: Number(plannedUnplannedRatio.toFixed(2)) };
  } catch (err) {
    console.error("summaryData error:", err);
    throw err;
  }
};

export const generateOrderNo = async (account_id: any): Promise<string> => {
  const year = new Date().getFullYear();
  const totalCount = await WorkOrderModel.countDocuments({ account_id, createdAt: { $gte: new Date(`${year}-01-01T00:00:00Z`), $lte: new Date(`${year}-12-31T23:59:59Z`)}});
  const sequence = String(totalCount + 1).padStart(4, "0");
  return `WO-${year}${sequence}`;
};

export const createWorkOrder = async (body: any, user: IUser): Promise<any> => {
  const newAsset = new WorkOrderModel({
    account_id : user.account_id,
    order_no : await generateOrderNo(user.account_id),
    title : body.title,
    description : body.description,
    estimated_time : body.estimated_time,
    priority : body.priority,
    status : body.status,
    type : body.type,
    nature_of_work : body.type,
    sop_form_id : body.sop_form_id,
    rescheduleEnabled : false,
    created_by : user._id,
    wo_asset_id : body.wo_asset_id,
    wo_location_id : body.wo_location_id,
    end_date : body.end_date,
    start_date : body.start_date,
    sopForm : body.sopForm,
    createdFrom : body.createdFrom,
    files : body.files,
    tasks : body.tasks,
    task_submitted : body.task_submitted,
    parts : body.parts,
    work_request_id : body.work_request_id,
    asset_report_id : body.asset_report_id,
    createdBy: user._id
  });
  const mappedUsers = body.userIdList.map((userId: string) => ({ userId: userId, woId: newAsset._id }));
  const userDetails = await UserModel.find({ _id: { $in: body.userIdList.map((userId: string) => new mongoose.Types.ObjectId(userId)) } });
  if (!userDetails || userDetails.length === 0) {
    throw Object.assign(new Error('No users found'), { status: 404 });
  }
  const result = await mapUsersWorkOrder(mappedUsers);
  if (!result || result.length === 0) {
    throw Object.assign(new Error('Failed to map users to work order'), { status: 500 });
  }
  const data = await newAsset.save();
  if (!data) {
    throw Object.assign(new Error('Failed to create work order'), { status: 400 });
  }
  if(body.parts?.length > 0) {
    await assignPartToWorkOrder(body.parts, user);
  }
  userDetails.forEach(async (assignedUsers: IUser) => {
    const orders = await getAllOrders({ _id: data._id });
    await sendWorkOrderMail(orders[0], assignedUsers, user);
  });
  return data;
};

export const updateById = async (id: string, body: any, user: IUser): Promise<any> => {
  if (!id) {
    throw Object.assign(new Error('Work Order ID is required'), { status: 400 });
  }
  let existingOrder: any = await WorkOrderModel.findById(id);
  if (!existingOrder) {
    throw Object.assign(new Error('Work Order not found'), { status: 404 });
  }
  existingOrder = { ...existingOrder.toObject(), ...body };
  if(body.parts?.length > 0) {
    if(body.oldParts?.length > 0) {
      await revertPartFromWorkOrder(body.oldParts, body.parts, user);
    }
  }
  existingOrder.updatedBy = user._id;
  await updateMappedUsers(id, body.userIdList);
  const data = await WorkOrderModel.findByIdAndUpdate(id, existingOrder, { new: true });
  if (!data) {
    throw Object.assign(new Error('Failed to update work order'), { status: 400 });
  }
  return data;
};

export const orderStatusChange = async (id: any, body: any): Promise<any> => {
  return await WorkOrderModel.findByIdAndUpdate(id, body, { new: true });
}

export const removeOrder = async (id: any, user_id: any): Promise<any> => {
  await removeMappedUsers(id);
  return await WorkOrderModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { new: true });
};

export const deleteWorkOrderById = async (id: any): Promise<any> => {
  await removeMappedUsers(id);
  return await WorkOrderModel.findByIdAndDelete(id);
}
