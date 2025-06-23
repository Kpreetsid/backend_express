import { WorkOrder, IWorkOrder } from "../../models/workOrder.model";
import { Request, Response, NextFunction } from 'express';
import { IUser, User } from "../../models/user.model";
import { get } from "lodash";
import { getData } from "../../util/queryBuilder";
import { Blog } from "../../models/help.model";
import { WorkOrderAssignee } from "../../models/mapUserWorkOrder.model";
import mongoose from "mongoose";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { id, status, priority, order_no, wo_asset_id } = req.query;
    const match: any = { account_id, visible: true };
    if (userRole !== 'admin') {
      const assigneeMappings = await WorkOrderAssignee.find({ user_id }, { woId: 1 });
      const mappedWoIds = assigneeMappings.map(item => item.woId);
      match._id = { $in: mappedWoIds };
    }
    if (id) match._id = { $in: id.toString().split(',').map(id => new mongoose.Types.ObjectId(id)) };
    if (status !== "all") match.status = { $nin: ["Completed"] };
    if (priority) match.priority = { $in: priority.toString().split(',') };
    if (order_no) match.order_no = { $in: order_no.toString().split(',') };
    if (wo_asset_id) match.wo_asset_id = { $in: wo_asset_id.toString().split(',') };
    let data = await WorkOrder.aggregate([
      { $match: match },
      { $lookup: { from: "wo_user_mapping", localField: "_id", foreignField: "woId", as: "assignedUsers" }},
      { $lookup: { from: "asset_master", localField: "wo_asset_id", foreignField: "_id", as: "asset" }},
      { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true }},
      { $lookup: { from: "location_master", localField: "wo_location_id", foreignField: "_id", as: "location" }},
      { $unwind: { path: "$location", preserveNullAndEmptyArrays: true }},
      { $lookup: { from: "users", localField: "created_by", foreignField: "_id", as: "createdBy" }},
      { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } }
    ]);
    if (!data.length) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const result = await Promise.all(data.map(async (item: any) => {
      let createdBy = {
        firstName: item.createdBy.firstName || "",
        id: item.createdBy._id,
        lastName: item.createdBy.lastName || "",
        user_profile_img: item.createdBy.user_profile_img || ""
      };
      item.createdBy = createdBy;
      item.assignedUsers = await Promise.all(item.assignedUsers.map(async (mapItem: any) => {
        const user = await getData(User, { filter: { _id: mapItem.userId }, select: '_id firstName lastName user_profile_img' });
        mapItem.user = user[0];
        return mapItem;
      }));
      item.id = item._id;
      return item;
    }));
    if (!result || result.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    return res.status(200).json({ status: true, message: "Data fetched successfully", data: result });
  } catch (error) {
    console.error("getAll error:", error);
    next(error);
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    if(!id) {
      throw Object.assign(new Error('No ID provided'), { status: 400 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id, visible: true };
    if (userRole !== 'admin') {
      match.user_id = user_id;
    }
    const data = await WorkOrder.aggregate([
      { $match: match },
      { $lookup: { from: "wo_user_mapping", localField: "_id", foreignField: "woId", as: "assignedUsers" }},
      { $lookup: { from: "asset_master", localField: "wo_asset_id", foreignField: "_id", as: "asset" }},
      { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true }},
      { $lookup: { from: "location_master", localField: "wo_location_id", foreignField: "_id", as: "location" }},
      { $unwind: { path: "$location", preserveNullAndEmptyArrays: true }},
      { $lookup: { from: "users", localField: "created_by", foreignField: "_id", as: "createdBy" }},
      { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } }
    ]);
    console.log(data);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const result = await Promise.all(data.map(async (item: any) => {
      let createdBy = {
        firstName: item.createdBy.firstName || "",
        id: item.createdBy._id,
        lastName: item.createdBy.lastName || "",
        user_profile_img: item.createdBy.user_profile_img || ""
      };
      item.createdBy = createdBy;
      item.assignedUsers = await Promise.all(item.assignedUsers.map(async (mapItem: any) => {
        const user = await getData(User, { filter: { _id: mapItem.userId }, select: '_id firstName lastName user_profile_img' });
        mapItem.user = user[0];
        return mapItem;
      }));
      const asset = {
        id: item.asset._id,
        asset_name: item.asset.asset_name || ""
      };
      item.asset = asset;
      const location = {
        id: item.location._id,
        location_name: item.location.location_name || ""
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
    console.error(error);
    next(error);
  }
};

export const orderStatus = async (req: Request, res: Response, next: NextFunction) => {
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
    const data: any = await getData(WorkOrder, { filter: match });
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
    console.error(error);
    next(error);
  }
};

export const orderPriority = async (req: Request, res: Response, next: NextFunction) => {
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
    const data: any = await getData(WorkOrder, { filter: match });
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
    console.error(error);
    next(error);
  }
};

export const monthlyCount = async (req: Request, res: Response, next: NextFunction) => {
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
    const data: any = await getData(WorkOrder, { filter: match });
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
    console.error(error);
    next(error);
  }
};

export const plannedUnplanned = async (req: Request, res: Response, next: NextFunction) => {
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
    const data: any = await getData(WorkOrder, { filter: match, select: "_id createdOn createdFrom" });
    if (data.length === 0) {
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
        final_result.date.forEach((item: any) => {
          final_result[element].push(0)
        });
      }
    });
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: final_result });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const summaryData = async (req: Request, res: Response, next: NextFunction) => {
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
    const helpData = await getData(Blog, { filter: helpMatch });
    if (helpData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const WO_list: any = await getData(WorkOrder, { filter: match });
    if (WO_list.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const todayDate = new Date().toISOString().split('T')[0];
    let complete_wo_on_time = [];
    let overdue_WO = [];
    let planned_WO = [];
    let Unplanned_WO = [];
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
    console.error(error);
    next(error);
  }
}

export const pendingOrders = async (req: Request, res: Response, next: NextFunction) => {
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
    const populate = [{ path: 'wo_asset_id', select: '_id asset_name' }, { path: 'wo_location_id', select: '_id location_name' }]
    let data = await getData(WorkOrder, { filter: match, populate: populate });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    data = data.map((item: any) => {
      item.asset = { id: item.wo_asset_id._id, asset_name: item.wo_asset_id.asset_name };
      item.wo_asset_id = item.wo_asset_id._id;
      item.location = { id: item.wo_location_id._id, location_name: item.wo_location_id.location_name };
      item.wo_location_id = item.wo_location_id._id;
      return item;
    })
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    req.body.account_id = account_id;
    req.body.user_id = user_id;
    const newAsset = new WorkOrder(req.body);
    const data = await newAsset.save();
    return res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { body } = req;
    const data = await WorkOrder.findByIdAndUpdate(id, body, { new: true });
    if (!data || !data.visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = await WorkOrder.findById(id);
    if (!data || !data.visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await WorkOrder.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};