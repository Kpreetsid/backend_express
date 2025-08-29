import { IWorkOrder, WorkOrderModel } from "../../models/workOrder.model";
import { Request, Response, NextFunction } from 'express';
import { IUser, UserModel } from "../../models/user.model";
import { get } from "lodash";
import { BlogModel, IBlog } from "../../models/help.model";
import mongoose from "mongoose";
import { sendWorkOrderMail } from "../../_config/mailer";
import { mapUsersWorkOrder, removeMappedUsers, updateMappedUsers } from "../../transaction/mapUserWorkOrder/userWorkOrder.service";

export const getAllOrders = async (match: any): Promise<any> => {
  match.visible = true;
  let data = await WorkOrderModel.aggregate([
    { $match: match },
    { $lookup: { from: "wo_user_mapping", localField: "_id", foreignField: "woId", as: "assignedUsers" }},
    { $lookup: { from: "asset_master", localField: "wo_asset_id", foreignField: "_id", as: "asset" }},
    { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true }},
    { $lookup: { from: "location_master", localField: "wo_location_id", foreignField: "_id", as: "location" }},
    { $unwind: { path: "$location", preserveNullAndEmptyArrays: true }}
  ]);
  if (!data.length) {
    throw Object.assign(new Error('No data found'), { status: 404 });
  }
  const result = await Promise.all(data.map(async (item: any) => {
    item.assignedUsers = await Promise.all(item.assignedUsers.map(async (mapItem: any) => {
      const user = await UserModel.find({ _id: mapItem.userId });
      mapItem.user = user.length > 0 ? user[0] : {};
      return mapItem;
    }));
    item.id = item._id;
    return item;
  }));
  return result;
};

export const getOrders = async (match: any): Promise<any> => {
  match.visible = true;
  const data = await WorkOrderModel.aggregate([
    { $match: match },
    { $lookup: { from: "wo_user_mapping", localField: "_id", foreignField: "woId", as: "assignedUsers" }},
    { $lookup: { from: "asset_master", localField: "wo_asset_id", foreignField: "_id", as: "asset" }},
    { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true }},
    { $lookup: { from: "location_master", localField: "wo_location_id", foreignField: "_id", as: "location" }},
    { $unwind: { path: "$location", preserveNullAndEmptyArrays: true }}
  ]);
  return data;
};

export const getDataById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if (!req.params.id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(req.params.id), account_id, visible: true };
    if (userRole !== 'admin') {
      match.user_id = user_id;
    }
    const data = await WorkOrderModel.aggregate([
      { $match: match },
      { $lookup: { from: "wo_user_mapping", localField: "_id", foreignField: "woId", as: "assignedUsers" }},
      { $lookup: { from: "asset_master", localField: "wo_asset_id", foreignField: "_id", as: "asset" }},
      { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true }},
      { $lookup: { from: "location_master", localField: "wo_location_id", foreignField: "_id", as: "location" }},
      { $unwind: { path: "$location", preserveNullAndEmptyArrays: true }},
      { $lookup: { 
        from: "users", 
        let: { createdById: "$createdBy" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$createdById"] } } },
          { $project: { _id: 1, firstName: 1, lastName: 1, user_profile_img: 1 } }
        ],
        as: "createdBy" 
      }},
      { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
      { $addFields: { id: '$_id' } }
    ]);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const result = await Promise.all(data.map(async (item: any) => {
      let createdBy = {
        firstName: item.createdBy?.firstName || "",
        id: item.createdBy?._id || item.createdBy?.id,
        lastName: item.createdBy?.lastName || "",
        user_profile_img: item.createdBy?.user_profile_img || ""
      };
      item.createdBy = createdBy;
      item.assignedUsers = await Promise.all(item.assignedUsers.map(async (mapItem: any) => {
        const user = await UserModel.find({ _id: mapItem.userId }, '_id firstName lastName user_profile_img');
        mapItem.user = user[0];
        return mapItem;
      }));
      const asset = {
        id: item.asset?._id || item.asset?.id,
        asset_name: item.asset?.asset_name || ""
      };
      item.asset = asset;
      const location = {
        id: item.location?._id || item.location?.id,
        location_name: item.location?.location_name || ""
      };
      item.location = location;
      item.id = item._id;
      return item;
    }));
    if (!result || result.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: result[0] });
  } catch (error) {
    next(error);
  }
};

export const orderStatus = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = { account_id: account_id, visible: true };
    if (query.wo_asset_id) {
      match.wo_asset_id = { $in: query.wo_asset_id.toString().split(',') };
    }
    if (userRole === 'admin') {
    } else {
      match.user_id = user_id;
    }
    const data: IWorkOrder[] = await WorkOrderModel.find(match)
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    let result = [
      { key: 'Open', value: 0 },
      { key: 'On-Hold', value: 0 },
      { key: 'In-Progress', value: 0 },
      { key: 'Completed', value: 0 }
    ];
    data.forEach((item: any) => {
      if (item.status === 'Open') {
        result[0].value = result[0].value + 1;
      } else if (item.status === 'On-Hold') {
        result[1].value = result[1].value + 1;
      } else if (item.status === 'In-Progress') {
        result[2].value = result[2].value + 1;
      } else if (item.status === 'Completed') {
        result[3].value = result[3].value + 1;
      }
    });
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: result });
  } catch (error) {
    next(error);
  }
};

export const orderPriority = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = { account_id: account_id, visible: true };
    if (query.wo_asset_id) {
      match.wo_asset_id = { $in: query.wo_asset_id.toString().split(',') };
    }
    if (userRole === 'admin') {
    } else {
      match.user_id = user_id;
    }
    const data: IWorkOrder[] = await WorkOrderModel.find(match);
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    let result = [
      { key: 'High', value: 0 },
      { key: 'Medium', value: 0 },
      { key: 'Low', value: 0 },
      { key: 'None', value: 0 }
    ];
    data.forEach((item: any) => {
      if (item.priority === 'High') {
        result[0].value = result[0].value + 1;
      } else if (item.priority === 'Medium') {
        result[1].value = result[1].value + 1;
      } else if (item.priority === 'Low') {
        result[2].value = result[2].value + 1;
      } else if (item.priority === 'None') {
        result[3].value = result[3].value + 1;
      }
    });
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: result });
  } catch (error) {
    next(error);
  }
};

export const monthlyCount = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = { account_id: account_id, visible: true };
    if (userRole === 'admin') {
    } else {
      match.user_id = user_id;
    }
    if (query.wo_asset_id) {
      match.wo_asset_id = { $in: query.wo_asset_id.toString().split(',') };
    }
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
      monthlyCountArray = Object.entries(monthlyCounts).map(([yearMonth, count]) => ({ _id: yearMonth, count }));
    });
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: monthlyCountArray });
  } catch (error) {
    next(error);
  }
};

export const plannedUnplanned = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = { account_id: account_id, visible: true };
    if (userRole === 'admin') {
    } else {
      match.user_id = user_id;
    }
    if (query.wo_asset_id) {
      match.wo_asset_id = { $in: query.wo_asset_id.toString().split(',') };
    }
    const data: IWorkOrder[] = await WorkOrderModel.find(match).select("_id createdOn createdFrom");
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const groupByCreatedFromAndMonth = data.reduce((acc: any, document: any) => {
      const monthYear = document.createdOn.toISOString().slice(0, 7);
      const key = `${document.createdFrom}-${monthYear}`;
      acc[key] = acc[key] || {
        createdFrom: document.createdFrom,
        monthYear,
        count: 0
      };
      acc[key].count++;
      return acc;
    }, {});
    const aggregatedData = Object.values(groupByCreatedFromAndMonth);
    const dataByCreatedFromAndMonth: any = {};
    aggregatedData.forEach((document: any) => {
      dataByCreatedFromAndMonth[document.createdFrom] = dataByCreatedFromAndMonth[document.createdFrom] || [];
      dataByCreatedFromAndMonth[document.createdFrom].push({
        monthYear: document.monthYear,
        count: document.count
      });
    });

    const months = [...new Set(aggregatedData.map((document: any) => document.monthYear))];
    const createdFrom = Object.keys(dataByCreatedFromAndMonth);
    const zeroCounts: any = {};
    createdFrom.forEach((createdFrom: any) => {
      zeroCounts[createdFrom] = zeroCounts[createdFrom] || [];
      months.forEach(month => {
        const count = (dataByCreatedFromAndMonth[createdFrom].find((c: any) => c.monthYear === month) || {}).count || 0;
        zeroCounts[createdFrom].push({
          monthYear: month,
          count
        });
      });
    });
    const countsByCreatedFrom = { ...dataByCreatedFromAndMonth, ...zeroCounts };
    const final_result: any = {
      date: [],
      "Work Order": [],
      Preventive: []
    };
    final_result.date = months;
    createdFrom.forEach((createdFrom: any) => {
      const counts = countsByCreatedFrom[createdFrom].map((count: any) => count.count);
      if (!final_result[createdFrom]) {
        final_result[createdFrom] = counts;
      } else {
        final_result[createdFrom] = counts.map((count: any, index: any) => {
          if (count === 0 && final_result[createdFrom][index] !== 0) {
            return 0;
          } else {
            return final_result[createdFrom][index] || count;
          }
        });
      }
    });

    let categories = ['Work Order', 'Preventive']
    categories.forEach((element: any) => {
      if (final_result[element].length == 0) {
        final_result.date.forEach(() => {
          final_result[element].push(0)
        });
      }
    });
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: final_result });
  } catch (error) {
    next(error);
  }
}

export const summaryData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = { account_id: account_id, visible: true };
    if (userRole === 'admin') {
    } else {
      match.user_id = user_id;
    }
    if (query.wo_asset_id) {
      match.wo_asset_id = { $in: query.wo_asset_id.toString().split(',') };
    }
    const helpMatch: any = { account_id, isActive: true, status: 'Approved' };
    const helpData: IBlog[] = await BlogModel.find(helpMatch);
    if (helpData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const WO_list: IWorkOrder[] = await WorkOrderModel.find(match);
    if (WO_list.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const todayDate = new Date().toISOString().split('T')[0];
    let complete_wo_on_time: any = [];
    let overdue_WO : any= [];
    let planned_WO: any = [];
    let Unplanned_WO: any = [];
    WO_list.map((item: any) => {
      if (item.status == 'Completed' && (new Date(item.end_date) >= new Date(item.completed_on))) {
        complete_wo_on_time.push(item);
      }
      if (item.status != 'Completed' && (new Date(item.end_date) < new Date(todayDate))) {
        overdue_WO.push(item);
      }
      if (item.createdFrom == 'Preventive') {
        planned_WO.push(item);
      } else if (item.createdFrom == 'Work Order' || item.createdFrom == 'Work Request') {
        Unplanned_WO.push(item);
      }
    })

    const planned_unplanned_ratio = (planned_WO.length / (planned_WO.length + Unplanned_WO.length)) * 100;
    const comp_rate = (complete_wo_on_time.length / WO_list.length) * 100;
    const final_res = {
      "completion_rate": comp_rate || 0,
      "overdue_WO": overdue_WO.length || 0,
      "work_request_count": helpData.length || 0,
      "planned_unplanned_ratio": planned_unplanned_ratio || 0
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: final_res });
  } catch (error) {
    next(error);
  }
}

export const pendingOrders = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query: any = req.query;
    const match: any = { account_id: account_id, visible: true };
    if (userRole === 'admin') {
    } else {
      match.user_id = user_id;
    }
    if (query.wo_asset_id) {
      match.wo_asset_id = { $in: query.wo_asset_id.toString().split(',') };
    }
    query.no_of_days = query.no_of_days || 30;
    var today = new Date()
    var priorDate = new Date(today.setDate(today.getDate() - query.no_of_days)).toISOString();
    match.createdOn = { $gte: priorDate };
    match.status = { $nin: ['Completed'] };
    let data: any = await WorkOrderModel.aggregate([
      { $match: match },
      { $lookup: { from: 'asset_master', localField: 'wo_asset_id', foreignField: '_id', as: 'asset' } },
      { $lookup: { from: 'location_master', localField: 'wo_location_id', foreignField: '_id', as: 'location' } },
      { $unwind: { path: '$asset', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } }
    ]);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const insert = async (body: any, user: IUser): Promise<any> => {
  const totalCount = await WorkOrderModel.countDocuments({ account_id: user.account_id });
  const newAsset = new WorkOrderModel({
    account_id : user.account_id,
    order_no : `WO-${totalCount + 1}`,
    title : body.title,
    description : body.description,
    estimated_time : body.estimated_time,
    priority : body.priority,
    status : body.status,
    nature_of_work : body.nature_of_work,
    rescheduleEnabled : false,
    created_by : user._id,
    wo_asset_id : body.wo_asset_id,
    wo_location_id : body.wo_location_id,
    assigned_to : body.assigned_to,
    end_date : body.end_date,
    start_date : body.start_date,
    sopForm : body.sopForm,
    teamId : body.teamId,
    workInstruction : body.workInstruction,
    actualParts : body.actualParts,
    createdFrom : "Work Order",
    creatorEmail : body.creatorEmail,
    attachment : body.attachment,
    task : body.task,
    estimatedParts : body.estimatedParts,
    createdBy: user._id
  });
  const mappedUsers = body.userIdList.map((userId: string) => ({ userId: userId, woId: newAsset._id }));
  const result = await mapUsersWorkOrder(mappedUsers);
  if (!result || result.length === 0) {
    throw Object.assign(new Error('Failed to map users to work order'), { status: 500 });
  }
  const data = await newAsset.save();
  if (!data) {
    throw Object.assign(new Error('Failed to create work order'), { status: 400 });
  }
  const userDetails = await UserModel.find({ _id: { $in: body.userIdList } });
  if (!userDetails || userDetails.length === 0) {
    throw Object.assign(new Error('No users found'), { status: 404 });
  }
  userDetails.forEach(async (assignedUsers: IUser) => {
    await sendWorkOrderMail(data, assignedUsers, user);
  });
  return data;
};

export const updateById = async (id: any, body: any): Promise<any> => {
  await updateMappedUsers(id, body.userIdList);
  return await WorkOrderModel.findByIdAndUpdate(id, body, { new: true });
};

export const removeOrder = async (id: any, user_id: any): Promise<any> => {
  await removeMappedUsers(id);
  return await WorkOrderModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { new: true });
};
