import { WorkOrderAssignee, IWorkOrderAssignee } from "../../models/mapUserWorkOrder.model";
import { Request, Response, NextFunction } from 'express';
import { WorkOrder } from "../../models/workOrder.model";
import { get } from "lodash";
import { IUser } from "../../models/user.model";

export const mappedData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { workOrderId } = req.params;
    const data: IWorkOrderAssignee[] = await WorkOrderAssignee.find({ woId: workOrderId })
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error: any) {
    next(error);
  }
};

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    const match: any = {};
    if(userRole === 'admin') {
      const workOrderMatch = { account_id: account_id, visible: true };
      const workOrderData: IWorkOrderAssignee[] = await WorkOrder.find(workOrderMatch);
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
      const workOrderData: IWorkOrderAssignee[] = await WorkOrder.find(workOrderMatch);
      if (!workOrderData || workOrderData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
    }
    const data: IWorkOrderAssignee[] = await WorkOrderAssignee.find(match).populate('woId');
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error: any) {
    next(error);
  }
};