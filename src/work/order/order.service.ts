import { IWorkOrder, WorkOrderModel } from "../../models/workOrder.model";
import { IUser, UserModel } from "../../models/user.model";
import { BlogModel, IBlog } from "../../models/help.model";
import { sendWorkOrderMail } from "../../_config/mailer";
import { mapUsersWorkOrder, removeMappedUsers, updateMappedUsers } from "../../transaction/mapUserWorkOrder/userWorkOrder.service";
import { assignPartToWorkOrder } from "../../masters/part/parts.service";
import { getAllCommentsForWorkOrder } from "../comments/comment.service";

export const getAllOrders = async (match: any): Promise<any> => {
  match.visible = true;
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
  match.visible = true;
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
  match.visible = true;
  const data: IWorkOrder[] = await WorkOrderModel.find(match).select("_id createdAt createdFrom");
  if (!data || data.length === 0) {
    throw Object.assign(new Error('No data found'), { status: 404 });
  }
  const groupByCreatedFromAndMonth = data.reduce((acc: any, document: any) => {
    const monthYear = document.createdAt.toISOString().slice(0, 7);
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
  return final_result;
}

export const summaryData = async (match: any): Promise<any> => {
  match.visible = true;
  const helpMatch: any = { account_id: match.account_id, visible: true, status: 'Approved' };
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
  return final_res;
}

export const pendingOrders = async (match: any): Promise<any> => {
  match.visible = true;
  return await WorkOrderModel.aggregate([
    { $match: match },
    { $lookup: { 
      from: 'asset_master', 
      let: { wo_asset_id: '$wo_asset_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$wo_asset_id'] } } },
        { $project: { _id: 1, asset_name: 1, asset_type: 1 } }
      ],
      as: 'asset'
    }},
    { $unwind: { path: '$asset', preserveNullAndEmptyArrays: true } },
    { $lookup: { 
      from: 'location_master', 
      let: { wo_location_id: '$wo_location_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$wo_location_id'] } } },
        { $project: { _id: 1, location_name: 1, location_type: 1 } }
      ],
      as: 'location'
    }},
    { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
    { $addFields: { id: '$_id' } }
  ]);
}

export const generateOrderNo = async (account_id: any): Promise<string> => {
  const year = new Date().getFullYear();
  const totalCount = await WorkOrderModel.countDocuments({
    account_id,
    createdAt: {
      $gte: new Date(`${year}-01-01T00:00:00Z`),
      $lte: new Date(`${year}-12-31T23:59:59Z`)
    }
  });
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
    sop_form_id : body.sop_form_id,
    rescheduleEnabled : false,
    created_by : user._id,
    wo_asset_id : body.wo_asset_id,
    wo_location_id : body.wo_location_id,
    end_date : body.end_date,
    start_date : body.start_date,
    sopForm : body.sopForm,
    workInstruction : body.workInstruction,
    actualParts : body.actualParts,
    createdFrom : body.createdFrom,
    files : body.files,
    tasks : body.tasks,
    task_submitted : body.task_submitted,
    parts : body.parts,
    work_request_id : body.work_request_id,
    createdBy: user._id
  });
  const mappedUsers = body.userIdList.map((userId: string) => ({ userId: userId, woId: newAsset._id }));
  const userDetails = await UserModel.find({ _id: { $in: body.userIdList } });
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
  if(body.parts?.estimated?.length > 0) {
    await assignPartToWorkOrder(body.parts, user);
  }
  userDetails.forEach(async (assignedUsers: IUser) => {
    const orders = await getAllOrders({ _id: data._id });
    await sendWorkOrderMail(orders[0], assignedUsers, user);
  });
  return data;
};

export const updateById = async (id: any, body: any): Promise<any> => {
  await updateMappedUsers(id, body.userIdList);
  return await WorkOrderModel.findByIdAndUpdate(id, body, { new: true });
};

export const orderStatusChange = async (id: any, body: any): Promise<any> => {
  return await WorkOrderModel.findByIdAndUpdate(id, body, { new: true });
}

export const removeOrder = async (id: any, user_id: any): Promise<any> => {
  await removeMappedUsers(id);
  return await WorkOrderModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { new: true });
};
