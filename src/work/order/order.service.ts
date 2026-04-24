import { IWorkOrder, WorkOrderModel } from "../../models/workOrder.model";
import { IUser, UserModel } from "../../models/user.model";
import { MailerService } from "../../_config/mailer";
import { userWorkOrderService } from "../../transaction/mapUserWorkOrder/userWorkOrder.service";
import { partsService } from "../../masters/part/parts.service";
import { commentService } from "../comments/comment.service";
import { requestService } from "../request/request.service";
import { helperService } from "../../utils/helper";
import { CommentsModel } from "../../models/comment.model";

export interface WorkOrderSearchParams {
  account_id: any;
  user_id: string;
  user_role: string;
  query: {
    status?: any;
    priority?: any;
    wo_asset_id?: any;
    wo_location_id?: any;
    assignedUser?: any;
    pageTYPE?: string; // assignedToMe, createdByMe, openToAll
    order_no?: string;
    fromDate?: string;
    toDate?: string;
  };
  pagination?: {
    skip: number;
    limit: number;
  };
}

class OrderService {
  private mailerService: MailerService;
  private userProjection = {
    _id: 1,
    id: "$_id",
    firstName: 1,
    lastName: 1,
    email: 1,
    username: 1,
    user_role: 1,
    user_status: 1,
    user_profile_img: 1
  };

  constructor() {
    this.mailerService = new MailerService();
  }

  private getWorkOrderPipeline(match: any): any[] {
    return [
      { $match: match },
      {
        $lookup: {
          from: "wo_user_mapping",
          let: { woId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$woId", "$$woId"] } } },
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "user"
              }
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                id: "$_id",
                userId: 1,
                woId: 1,
                user: {
                  _id: "$user._id",
                  id: "$user._id",
                  firstName: "$user.firstName",
                  lastName: "$user.lastName",
                  email: "$user.email",
                  username: "$user.username",
                  user_role: "$user.user_role",
                  user_status: "$user.user_status",
                  user_profile_img: "$user.user_profile_img"
                }
              }
            }
          ],
          as: "assignedUsers"
        }
      },
      {
        $lookup: {
          from: "asset_master",
          let: { wo_asset_id: '$wo_asset_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$wo_asset_id'] }, visible: true } },
            { $project: { _id: 1, id: '$_id', asset_name: 1, asset_type: 1, asset_model: 1, top_level: 1, parent_id: 1, visible: 1 } },
          ],
          as: "asset"
        }
      },
      { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "location_master",
          let: { wo_location_id: '$wo_location_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$wo_location_id'] }, visible: true } },
            { $project: { _id: 1, id: '$_id', location_name: 1, location_type: 1, top_level: 1, parent_id: 1, visible: 1 } },
          ],
          as: "location"
        }
      },
      { $unwind: { path: "$location", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          let: { createdBy: '$createdBy' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$createdBy'] } } },
            { $project: this.userProjection },
          ],
          as: "createdBy"
        }
      },
      { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          let: { updatedBy: '$updatedBy' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$updatedBy'] } } },
            { $project: this.userProjection },
          ],
          as: "updatedBy"
        }
      },
      { $unwind: { path: "$updatedBy", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "status_details.createdBy",
          foreignField: "_id",
          as: "statusUsers"
        }
      },
      {
        $lookup: {
          from: "users",
          let: { userIds: "$tasks.assigned_user_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    { $toString: "$_id" },
                    {
                      $map: {
                        input: { $ifNull: ["$$userIds", []] },
                        as: "id",
                        in: { $toString: { $ifNull: ["$$id", ""] } }
                      }
                    }
                  ]
                }
              }
            }
          ],
          as: "taskUsers"
        }
      },
      {
        $addFields: {
          id: "$_id",
          tasks: {
            $map: {
              input: { $ifNull: ["$tasks", []] },
              as: "task",
              in: {
                $mergeObjects: [
                  "$$task",
                  {
                    assignedUser: {
                      $let: {
                        vars: {
                          matchedUser: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$taskUsers",
                                  as: "u",
                                  cond: {
                                    $eq: [
                                      { $toString: "$$u._id" },
                                      { $toString: { $ifNull: ["$$task.assigned_user_id", ""] } }
                                    ]
                                  }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: {
                          $cond: [
                            { $gt: ["$$matchedUser", null] },
                            {
                              _id: "$$matchedUser._id",
                              id: "$$matchedUser._id",
                              firstName: "$$matchedUser.firstName",
                              lastName: "$$matchedUser.lastName",
                              email: "$$matchedUser.email",
                              username: "$$matchedUser.username",
                              user_profile_img: "$$matchedUser.user_profile_img",
                              user_role: "$$matchedUser.user_role",
                              user_status: "$$matchedUser.user_status"
                            },
                            null
                          ]
                        }
                      }
                    }
                  }
                ]
              }
            }
          },
          status_details: {
            $map: {
              input: "$status_details",
              as: "status",
              in: {
                status: "$$status.status",
                createdAt: "$$status.createdAt",
                createdBy: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$statusUsers",
                        as: "u",
                        cond: { $eq: ["$$u._id", "$$status.createdBy"] }
                      }
                    },
                    0
                  ]
                }
              }
            }
          }
        }
      },
      { $project: { statusUsers: 0, taskUsers: 0 } }
    ];
  }

  async getAllOrders(match: any): Promise<any> {
    const pipeline = this.getWorkOrderPipeline(match);
    const data = await WorkOrderModel.aggregate(pipeline);

    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const orderIds = data.map((d: any) => d._id);
    // Bulk fetch all comments for all returned orders to avoid N+1 inside the loop
    const allComments = await CommentsModel.find({ order_id: { $in: orderIds }, visible: true, parentCommentId: null })
      .populate([{ path: 'createdBy', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status' }])
      .lean();

    const result = await Promise.all(data.map(async (item: any) => {
      // Map comments from the bulk fetch
      const itemComments = allComments.filter((c: any) => String(c.order_id) === String(item._id));
      
      // Still need the recursive replies (which could be improved in CommentService)
      item.comments = await Promise.all(itemComments.map(async (c: any) => ({
        ...c,
        id: c._id,
        replies: await commentService.getNestedComments(c._id)
      })));
      
      return item;
    }));
    return result;
  };

  async buildSearchMatch(params: WorkOrderSearchParams): Promise<any> {
    const { account_id, user_id, user_role, query } = params;
    const match: any = { account_id, visible: true };

    if (query.status) match.status = { $in: query.status.toString().split(',') };
    if (query.priority) match.priority = { $in: query.priority.toString().split(',') };
    if (query.wo_asset_id) match.wo_asset_id = { $in: helperService.validateObjectIds(query.wo_asset_id.toString()) };
    if (query.wo_location_id) match.wo_location_id = { $in: helperService.validateObjectIds(query.wo_location_id.toString()) };
    if (query.order_no) match.order_no = query.order_no;
    
    if (query.fromDate && query.toDate) {
      match.createdAt = { $gte: new Date(query.fromDate), $lte: new Date(query.toDate) };
    }

    if (query.assignedUser) {
      const assignedIds = helperService.validateObjectIds(query.assignedUser.toString());
      const workOrderIds = [];
      for (const uid of assignedIds) {
        workOrderIds.push(await userWorkOrderService.getMappedWorkOrderIDs(uid));
      }
      match._id = { $in: workOrderIds.flat() };
    }

    // Role and PageType Logic
    if (query.pageTYPE) {
      switch (query.pageTYPE) {
        case "assignedToMe": {
          const ids = await userWorkOrderService.getMappedWorkOrderIDs(user_id);
          match._id = { $in: ids || [] };
          break;
        }
        case "createdByMe": {
          match.createdBy = user_id;
          break;
        }
        case "openToAll": {
          match.createdBy = { $ne: user_id };
          if (!query.status) {
            match.status = { $in: ["Open", "In-Progress", "On-Hold"] };
          }
          const ids = await userWorkOrderService.getMappedWorkOrderIDs(user_id);
          if (ids?.length) match._id = { $nin: ids };
          break;
        }
      }
    } else if (user_role !== 'admin') {
      const userWorkOrderIdList = await userWorkOrderService.getMappedWorkOrderIDs(user_id);
      if (!userWorkOrderIdList || userWorkOrderIdList.length === 0) {
        match.createdBy = user_id;
      } else {
        match.$or = [{ _id: { $in: userWorkOrderIdList } }, { createdBy: user_id }];
      }
    }

    return match;
  }

  async countOrders(match: any) {
    return await WorkOrderModel.countDocuments(match);
  }

  async getAllWorkOrders(match: any, skip: number = 0, limit: number = 25) {
    const pipeline: any[] = this.getWorkOrderPipeline(match);
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const data = await WorkOrderModel.aggregate(pipeline);

    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const orderIds = data.map((d: any) => d._id);
    const allComments = await CommentsModel.find({ order_id: { $in: orderIds }, visible: true, parentCommentId: null })
      .populate([{ path: 'createdBy', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status' }])
      .lean();

    const result = await Promise.all(data.map(async (item: any) => {
      const itemComments = allComments.filter((c: any) => String(c.order_id) === String(item._id));
      
      item.comments = await Promise.all(itemComments.map(async (c: any) => ({
        ...c,
        id: c._id,
        replies: await commentService.getNestedComments(c._id)
      })));
      return item;
    }));
    return result;
  }

  async orderStatus(match: any): Promise<any> {
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

  async orderPriority(match: any): Promise<any> {
    match.visible = true;
    const data: IWorkOrder[] = await WorkOrderModel.aggregate([
      { $match: match },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $project: { _id: 0, key: '$_id', value: '$count' } }
    ]);
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    let priorityLevels = ['Urgent', 'High', 'Medium', 'Low'];
    let result = priorityLevels.map((level: any) => {
      const found: any = data.find((d: any) => d.key === level);
      return { key: level, value: found ? found.value : 0 };
    });
    return result;
  };

  async monthlyCount(match: any): Promise<any> {
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

  async plannedUnplanned(match: any): Promise<any> {
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

  async summaryData(workOrderMatch: any): Promise<any> {
    try {
      const workOrders: any = await WorkOrderModel.find(workOrderMatch).lean();
      const today = new Date();
      const completedOnTime: any[] = [];
      const overdueWO: any[] = [];
      const plannedWO: any[] = [];
      const unplannedWO: any[] = [];
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
        } else {
          unplannedWO.push(item);
        }
      }
      const workRequestMatch: any = { status: { $nin: ['completed'] }, asset_id: workOrderMatch.wo_asset_id }
      if (workOrderMatch.wo_location_id) {
        workRequestMatch.location_id = workOrderMatch.wo_location_id;
      }
      if (workOrderMatch.createdAt) {
        workRequestMatch.createdAt = workOrderMatch.createdAt;
      }
      const workRequests = await requestService.getAllRequests(workRequestMatch);
      const plannedUnplannedRatio = workOrders.length ? (plannedWO.length / (plannedWO.length + unplannedWO.length)) * 100 : 0;
      const completionRate = workOrders.length ? (completedOnTime.length / workOrders.length) * 100 : 0;
      return { completion_rate: Number(completionRate.toFixed(2)), overdue_WO: overdueWO.length, work_request_count: workRequests.length, planned_unplanned_ratio: Number(plannedUnplannedRatio.toFixed(2)) };
    } catch (err) {
      console.error("summaryData error:", err);
      throw err;
    }
  };

  async generateOrderNo(account_id: any): Promise<string> {
    const year = new Date().getFullYear();
    const totalCount = await WorkOrderModel.countDocuments({ account_id, createdAt: { $gte: new Date(`${year}-01-01T00:00:00Z`), $lte: new Date(`${year}-12-31T23:59:59Z`) } });
    const sequence = String(totalCount + 1).padStart(4, "0");
    return `WO-${year}${sequence}`;
  };

  async createWorkOrder(body: any, user: IUser): Promise<any> {
    const newAsset = new WorkOrderModel({
      account_id: user.account_id,
      order_no: await this.generateOrderNo(user.account_id),
      title: body.title,
      description: body.description,
      estimated_time: body.estimated_time,
      parentId: body.parentId,
      priority: body.priority,
      status: body.status,
      type: body.type,
      nature_of_work: body.type,
      sop_form_id: body.sop_form_id,
      rescheduleEnabled: false,
      created_by: user._id,
      wo_asset_id: body.wo_asset_id,
      wo_location_id: body.wo_location_id,
      end_date: body.end_date,
      start_date: body.start_date,
      sopForm: body.sopForm,
      createdFrom: body.createdFrom,
      files: body.files,
      tasks: body.tasks,
      task_submitted: body.task_submitted,
      parts: body.parts,
      work_request_id: body.work_request_id,
      asset_report_id: body.asset_report_id,
      status_details: [{ status: body.status, createdBy: user._id }],
      createdBy: user._id
    });
    const mappedUsers = body.userIdList.map((userId: string) => ({ userId: userId, woId: newAsset._id }));
    const userDetails = await UserModel.find({ _id: { $in: helperService.validateObjectIds(body.userIdList.join(',')) } });
    if (!userDetails || userDetails.length === 0) {
      throw Object.assign(new Error('No users found'), { status: 404 });
    }
    const result = await userWorkOrderService.mapUsersWorkOrder(mappedUsers);
    if (!result || result.length === 0) {
      throw Object.assign(new Error('Failed to map users to work order'), { status: 500 });
    }
    const data: any = await newAsset.save();
    if (!data) {
      throw Object.assign(new Error('Failed to create work order'), { status: 400 });
    }
    if (body.parts?.length > 0) {
      const inventoryResult = await partsService.adjustInventoryByWorkOrder([], body.parts, user);
      data.inventoryWarnings = inventoryResult.warnings;
    }
    userDetails.forEach(async (assignedUsers: IUser) => {
      const orders = await this.getAllOrders({ _id: data._id });
      await this.mailerService.sendWorkOrderMail(orders[0], assignedUsers, user);
    });
    return data;
  };

  async updateById(id: string, body: any, user: IUser): Promise<any> {
    const objectId = helperService.validateObjectId(id);
    let existingOrder: any = await WorkOrderModel.findById(objectId);
    if (!existingOrder) {
      throw Object.assign(new Error('Work Order not found'), { status: 404 });
    }
    existingOrder = { ...existingOrder.toObject(), ...body };
    if (body.parts?.length > 0) {
      const inventoryResult = await partsService.adjustInventoryByWorkOrder(body.oldParts || [], body.parts, user);
      existingOrder.inventoryWarnings = inventoryResult.warnings;
    }
    existingOrder.updatedBy = user._id;
    if (body.hasOwnProperty('userIdList')) {
      await userWorkOrderService.updateMappedUsers(id, body.userIdList);
    }
    const data = await WorkOrderModel.findByIdAndUpdate(id, existingOrder, { new: true });
    if (!data) {
      throw Object.assign(new Error('Failed to update work order'), { status: 400 });
    }
    return data;
  };

  async updateDataById(id: string, body: any, user: IUser): Promise<any> {
    return await WorkOrderModel.findByIdAndUpdate(id, { ...body, updatedBy: user._id }, { new: true });
  };

  async orderStatusChange(id: string, status: string, user: IUser): Promise<any> {
    const orderId = helperService.validateObjectId(id);
    const orders = await this.getAllOrders({ _id: orderId, account_id: user.account_id, visible: true });
    const existingOrder = orders[0];

    if (status === 'Completed') {
      if (existingOrder.tasks?.length > 0 && !existingOrder.task_submitted) {
        throw Object.assign(new Error('Task is not completed'), { status: 400 });
      }
      if (existingOrder.sop_form_id && !existingOrder.sop_form_submitted) {
        throw Object.assign(new Error('Form is not completed'), { status: 400 });
      }
      if (existingOrder.parts?.length > 0) {
        existingOrder.parts = existingOrder.parts.map((part: any) => ({
          ...part,
          actualQuantity: part.actualQuantity || part.estimatedQuantity
        }));
      }
    } else if (status === 'Open') {
      existingOrder.task_submitted = false;
      existingOrder.sop_form_submitted = false;
    }

    const statusEntry = { status, createdBy: user._id, createdAt: new Date() };
    const statusDetails = [...(existingOrder.status_details || []), statusEntry];

    return await WorkOrderModel.findByIdAndUpdate(
      id,
      { status, updatedBy: user._id, status_details: statusDetails, parts: existingOrder.parts, task_submitted: existingOrder.task_submitted, sop_form_submitted: existingOrder.sop_form_submitted },
      { new: true }
    );
  }

  async removeOrder(id: any, user_id: any): Promise<any> {
    await userWorkOrderService.removeMappedUsers(id);
    const order: any = await WorkOrderModel.findById(id).lean();
    if (order?.parts?.length > 0) {
      await partsService.adjustInventoryByWorkOrder(order.parts, [], { _id: user_id });
    }
    return await WorkOrderModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { new: true });
  };

  async deleteWorkOrderById(id: any, user_id: any): Promise<any> {
    await userWorkOrderService.removeMappedUsers(id);
    const order: any = await WorkOrderModel.findById(id).lean();
    if (order?.parts?.length > 0) {
      await partsService.adjustInventoryByWorkOrder(order.parts, [], { _id: user_id });
    }
    return await WorkOrderModel.findByIdAndDelete(id);
  }

  async getHistory(id: string): Promise<any> {
    const objectId = helperService.validateObjectId(id);
    const HistoryModel = (WorkOrderModel as any).getHistoryModel();
    const pipeline = this.getWorkOrderPipeline({ original_id: objectId });
    pipeline.push({ $sort: { history_created_at: -1 } });
    const history = await HistoryModel.aggregate(pipeline);
    if (!history || history.length === 0) {
      throw Object.assign(new Error('No history found for this work order'), { status: 404 });
    }
    return history;
  }
}

export const orderService = new OrderService();