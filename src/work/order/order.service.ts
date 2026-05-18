import { IWorkOrder, WorkOrderModel } from "../../models/workOrder.model";
import { IUser, UserModel } from "../../models/user.model";
import { MailerService } from "../../_config/mailer";
import { userWorkOrderService } from "../../transaction/mapUserWorkOrder/userWorkOrder.service";
import { partsService } from "../../masters/part/parts.service";
import { commentService } from "../comments/comment.service";
import { requestService } from "../request/request.service";
import { helperService } from "../../utils/helper";
import { notificationService } from "../../utils/notification.service";
import { withTransaction } from "../../utils/transaction.helper";

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

  private sanitizeWorkOrder(data: any): any {
    if (data.tasks && Array.isArray(data.tasks)) {
      data.tasks = data.tasks.map((task: any) => {
        const sanitizedTask = { ...task };
        if (sanitizedTask.assigned_user_id === '') {
          sanitizedTask.assigned_user_id = null;
        }
        return sanitizedTask;
      });
    }

    const objectIdFields = [
      'wo_asset_id',
      'wo_location_id',
      'sop_form_id',
      'work_request_id',
      'asset_report_id',
      'parentId',
      'updatedBy',
      'createdBy'
    ];

    objectIdFields.forEach(field => {
      if (data[field] === '') {
        data[field] = null;
      }
    });

    return data;
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
                let: { userId: '$userId' },
                pipeline: [
                  { $match: { $expr: { $eq: ['$_id', '$$userId'] }, user_status: 'active' } },
                  { $project: this.userProjection },
                ],
                as: "user"
              }
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } }
          ],
          as: "assignedUsers"
        }
      },
      {
        $lookup: {
          from: "asset_master",
          let: { wo_asset_id: '$wo_asset_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $eq: [
                    '$_id', 
                    { $cond: [{ $eq: [{ $type: '$$wo_asset_id' }, 'string'] }, { $toObjectId: '$$wo_asset_id' }, '$$wo_asset_id'] }
                  ] 
                }, 
                visible: true 
              } 
            },
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
            { 
              $match: { 
                $expr: { 
                  $eq: [
                    '$_id', 
                    { $cond: [{ $eq: [{ $type: '$$wo_location_id' }, 'string'] }, { $toObjectId: '$$wo_location_id' }, '$$wo_location_id'] }
                  ] 
                }, 
                visible: true 
              } 
            },
            { $project: { _id: 1, id: '$_id', location_name: 1, location_type: 1, top_level: 1, parent_id: 1, visible: 1 } },
          ],
          as: "location"
        }
      },
      { $unwind: { path: "$location", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "sops",
          let: { sop_form_id: '$sop_form_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $eq: [
                    '$_id', 
                    { $cond: [{ $eq: [{ $type: '$$sop_form_id' }, 'string'] }, { $toObjectId: '$$sop_form_id' }, '$$sop_form_id'] }
                  ] 
                }, 
                visible: true 
              } 
            },
            { $project: { _id: 1, id: '$_id', name: 1, description: 1, json_temp: 1, visible: 1 } },
          ],
          as: "sopForm"
        }
      },
      { $unwind: { path: "$sopForm", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          let: { createdBy: '$createdBy' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$createdBy'] }, user_status: 'active' } },
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
            { $match: { $expr: { $eq: ['$_id', '$$updatedBy'] }, user_status: 'active' } },
            { $project: this.userProjection },
          ],
          as: "updatedBy"
        }
      },
      { $unwind: { path: "$updatedBy", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          let: { createdBy: '$status_details.createdBy' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$createdBy'] }, user_status: 'active' } },
            { $project: this.userProjection },
          ],
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
        $lookup: {
          from: "mst_part_types",
          let: { partTypeIds: "$parts.part_type" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    { $toString: "$_id" },
                    {
                      $map: {
                        input: { $ifNull: ["$$partTypeIds", []] },
                        as: "id",
                        in: { $toString: "$$id" }
                      }
                    }
                  ]
                }
              }
            },
            { $project: { _id: 1, name: 1, description: 1, visible: 1 } }
          ],
          as: "partTypeDetails"
        }
      },
      {
        $addFields: {
          id: "$_id",
          parts: {
            $map: {
              input: { $ifNull: ["$parts", []] },
              as: "part",
              in: {
                $mergeObjects: [
                  "$$part",
                  {
                    partTypeData: {
                      $let: {
                        vars: {
                          found: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$partTypeDetails",
                                  as: "pt",
                                  cond: { $eq: [{ $toString: "$$pt._id" }, { $toString: "$$part.part_type" }] }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: {
                          $cond: [
                            { $gt: ["$$found", null] },
                            "$$found",
                            { 
                              id: '', 
                              name: { 
                                $cond: [
                                  { 
                                    $and: [
                                      { $eq: [{ $type: "$$part.part_type" }, "string"] },
                                      { $lt: [{ $strLenCP: "$$part.part_type" }, 24] } // Simple check: if it's 24 chars, it's likely an ID, don't use as name
                                    ] 
                                  }, 
                                  "$$part.part_type", 
                                  ""
                                ] 
                              }, 
                              description: '', 
                              visible: true 
                            }
                          ]
                        }
                      }
                    }
                  }
                ]
              }
            }
          },
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
    const commentMap = await commentService.getCommentsByOrderIds(orderIds);

    const result = [];
    for (const item of data) {
      item.comments = commentMap.get(String(item._id)) || [];
      result.push(item);
    }
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
      const workOrderIdArrays = await Promise.all(assignedIds.map(uid => userWorkOrderService.getMappedWorkOrderIDs(uid)));
      match._id = { $in: workOrderIdArrays.flat() };
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
    const commentMap = await commentService.getCommentsByOrderIds(orderIds);

    const result = [];
    for (const item of data) {
      item.comments = commentMap.get(String(item._id)) || [];
      result.push(item);
    }
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
    const data = await WorkOrderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $project: { id: "$_id", count: 1, _id: 0 } },
      { $sort: { id: 1 } }
    ]);

    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return data;
  };

  async plannedUnplanned(match: any): Promise<any> {
    const data = await WorkOrderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            createdFrom: { $ifNull: ["$createdFrom", "Work Order"] },
            monthYear: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          createdFrom: "$_id.createdFrom",
          monthYear: "$_id.monthYear",
          count: 1
        }
      },
      { $sort: { monthYear: 1 } }
    ]);

    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const months = [...new Set(data.map(a => a.monthYear))].sort();
    const categories = ['Work Order', 'Preventive'];
    const final_result: any = { date: months };

    for (const cat of categories) {
      final_result[cat] = months.map(month => {
        const found = data.find(d => d.createdFrom === cat && d.monthYear === month);
        return found ? found.count : 0;
      });
    }

    return final_result;
  };

  async summaryData(workOrderMatch: any): Promise<any> {
    try {
      const today = new Date();
      const aggregationResults = await WorkOrderModel.aggregate([
        { $match: workOrderMatch },
        {
          $facet: {
            completedOnTime: [
              {
                $match: {
                  status: 'Completed',
                  updatedAt: { $exists: true },
                  $expr: { $lte: ["$updatedAt", "$end_date"] }
                }
              },
              { $count: "count" }
            ],
            overdue: [
              {
                $match: {
                  status: { $ne: 'Completed' },
                  end_date: { $lt: today }
                }
              },
              { $count: "count" }
            ],
            planned: [
              { $match: { createdFrom: "Preventive" } },
              { $count: "count" }
            ],
            total: [
              { $count: "count" }
            ]
          }
        }
      ]);

      const result = aggregationResults[0];
      const totalCount = result.total[0]?.count || 0;
      const completedOnTimeCount = result.completedOnTime[0]?.count || 0;
      const overdueCount = result.overdue[0]?.count || 0;
      const plannedCount = result.planned[0]?.count || 0;

      const workRequestMatch: any = { status: { $nin: ['completed'] }, asset_id: workOrderMatch.wo_asset_id }
      if (workOrderMatch.wo_location_id) workRequestMatch.location_id = workOrderMatch.wo_location_id;
      if (workOrderMatch.createdAt) workRequestMatch.createdAt = workOrderMatch.createdAt;

      const workRequestCount = await requestService.countRequests(workRequestMatch);

      const plannedUnplannedRatio = totalCount ? (plannedCount / totalCount) * 100 : 0;
      const completionRate = totalCount ? (completedOnTimeCount / totalCount) * 100 : 0;

      return {
        completion_rate: Number(completionRate.toFixed(2)),
        overdue_WO: overdueCount,
        work_request_count: workRequestCount,
        planned_unplanned_ratio: Number(plannedUnplannedRatio.toFixed(2))
      };
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
    return await withTransaction(async (session) => {
      const userIdList = Array.isArray(body.userIdList) ? body.userIdList.filter((userId: string) => !!userId) : [];
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
        parts: body.parts,
        work_request_id: body.work_request_id,
        asset_report_id: body.asset_report_id,
        status_details: [{ status: body.status, createdBy: user._id }],
        createdBy: user._id
      });

      const sanitizedData = this.sanitizeWorkOrder(newAsset.toObject());
      Object.assign(newAsset, sanitizedData);

      const data: any = await newAsset.save({ session });
      if (!data) {
        throw Object.assign(new Error('Failed to create work order'), { status: 400 });
      }

      let userDetails: IUser[] = [];
      if (userIdList.length > 0) {
        const mappedUsers = userIdList.map((userId: string) => ({ userId, woId: newAsset._id }));
        userDetails = await UserModel.find({ _id: { $in: helperService.validateObjectIds(userIdList.join(',')) } }).session(session);
        if (!userDetails || userDetails.length === 0) {
          throw Object.assign(new Error('No users found'), { status: 404 });
        }

        const result = await userWorkOrderService.mapUsersWorkOrder(mappedUsers, session);
        if (!result || result.length === 0) {
          throw Object.assign(new Error('Failed to map users to work order'), { status: 500 });
        }
      }
      
      if (body.parts?.length > 0) {
        const inventoryResult = await partsService.adjustInventoryByWorkOrder([], body.parts, user, session);
        data.inventoryWarnings = inventoryResult.warnings;
      }
      
      if (userDetails.length > 0) {
        userDetails.forEach(async (assignedUsers: IUser) => {
          const orders = await this.getAllOrders({ _id: data._id });
          await this.mailerService.sendWorkOrderMail(orders[0], assignedUsers, user);
        });
      }
      
      await notificationService.notifyAccountUsers({
        accountId: String(user.account_id),
        module: 'Work Order',
        event: 'created',
        entityId: String(data._id),
        entityName: data.title || data.order_no || 'Work Order',
        actionUrl: `/work-order/details/${data._id}`,
        sourceUserId: String(user._id)
      });
      
      const resultData = await this.getAllOrders({ _id: data._id });
      return resultData[0];
    });
  };

  async updateById(id: any, body: any, user: IUser): Promise<any> {
    return await withTransaction(async (session) => {
      let existingOrder: any = await WorkOrderModel.findById(id).session(session);
      if (!existingOrder) {
        throw Object.assign(new Error('Work Order not found'), { status: 404 });
      }
      
      let updatedData = { ...existingOrder.toObject(), ...body };
      
      if (body.parts?.length > 0) {
        const inventoryResult = await partsService.adjustInventoryByWorkOrder(body.oldParts || [], body.parts, user, session);
        updatedData.inventoryWarnings = inventoryResult.warnings;
      }
      
      updatedData.updatedBy = user._id;
      if (body.hasOwnProperty('userIdList')) {
        await userWorkOrderService.updateMappedUsers(id, body.userIdList, session);
      }

      updatedData = this.sanitizeWorkOrder(updatedData);
      const data = await WorkOrderModel.findByIdAndUpdate(id, updatedData, { returnDocument: 'after', session });
      if (!data) {
        throw Object.assign(new Error('Failed to update work order'), { status: 400 });
      }
      
      const resultData = await this.getAllOrders({ _id: id });
      await notificationService.notifyAccountUsers({
        accountId: String(user.account_id),
        module: 'Work Order',
        event: 'updated',
        entityId: String(id),
        entityName: resultData[0]?.title || resultData[0]?.order_no || 'Work Order',
        actionUrl: `/work-order/details/${id}`,
        sourceUserId: String(user._id)
      });
      return resultData[0];
    });
  };

  async updateDataById(id: any, body: any, user: IUser): Promise<any> {
    const sanitizedBody = this.sanitizeWorkOrder({ ...body, updatedBy: user._id });
    return await WorkOrderModel.findByIdAndUpdate(id, sanitizedBody, { returnDocument: 'after' });
  };

  async orderStatusChange(id: string, status: string, user: IUser): Promise<any> {
    const orderId = helperService.validateObjectId(id);
    const orders = await this.getAllOrders({ _id: orderId, account_id: user.account_id, visible: true });
    const existingOrder = orders[0];

    if (status === 'Completed') {
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
      existingOrder.sop_form_submitted = false;
      existingOrder.sop_form_updated_by = null;
      existingOrder.sop_form_updated_at = null;
    }

    const statusEntry = { status, createdBy: user._id, createdAt: new Date() };
    const statusDetails = [...(existingOrder.status_details || []), statusEntry];

    const data = await WorkOrderModel.findByIdAndUpdate(
      id,
      { 
        status, 
        updatedBy: user._id, 
        status_details: statusDetails, 
        parts: existingOrder.parts, 
        sop_form_submitted: existingOrder.sop_form_submitted,
        sop_form_updated_by: existingOrder.sop_form_updated_by,
        sop_form_updated_at: existingOrder.sop_form_updated_at
      },
      { returnDocument: 'after' }
    );
    if (data) {
      await notificationService.notifyAccountUsers({
        accountId: String(user.account_id),
        module: 'Work Order',
        event: 'updated',
        entityId: String(id),
        entityName: data.title || data.order_no || 'Work Order',
        actionUrl: `/work-order/details/${id}`,
        sourceUserId: String(user._id)
      });
    }
    return data;
  }

  async removeOrder(id: any, user_id: any): Promise<any> {
    return await withTransaction(async (session) => {
      await userWorkOrderService.removeMappedUsers(id, session);
      const order: any = await WorkOrderModel.findById(id).session(session).lean();
      if (order?.parts?.length > 0) {
        await partsService.adjustInventoryByWorkOrder(order.parts, [], { _id: user_id }, session);
      }
      return await WorkOrderModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { returnDocument: 'after', session });
    });
  };

  async deleteWorkOrderById(id: any, user_id: any): Promise<any> {
    return await withTransaction(async (session) => {
      await userWorkOrderService.removeMappedUsers(id, session);
      const order: any = await WorkOrderModel.findById(id).session(session).lean();
      if (order?.parts?.length > 0) {
        await partsService.adjustInventoryByWorkOrder(order.parts, [], { _id: user_id }, session);
      }
      return await WorkOrderModel.findByIdAndDelete(id, { session });
    });
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
