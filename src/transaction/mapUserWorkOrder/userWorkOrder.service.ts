import { hasPermission } from "../../_config/permission";
import { WorkOrderAssignee, IWorkOrderAssignee } from "../../models/mapUserWorkOrder.model";
import { Request, Response, NextFunction } from 'express';
import { getData } from "../../util/queryBuilder";
import { WorkOrder } from "../../models/workOrder.model";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = req.user;
    const query = req.query;
    const match: any = {};
    if(hasPermission('admin')) {
      const workOrderMatch = { account_id: account_id, visible: true };
      const workOrderData = await getData(WorkOrder, { filter: workOrderMatch });
      if (!workOrderData || workOrderData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      match.woId = { $in: workOrderData.map(doc => doc._id) };
    } else {
      match.userId = user_id;
    }
    if(query.workOrderId) {
      match.woId = query.workOrderId;
      const workOrderMatch = { _id: query.workOrderId, account_id : account_id };
      const workOrderData = await getData(WorkOrder, { filter: workOrderMatch });
      if (!workOrderData || workOrderData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
    }
    const data = await getData(WorkOrderAssignee, { filter: match, populate: 'woId' });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};