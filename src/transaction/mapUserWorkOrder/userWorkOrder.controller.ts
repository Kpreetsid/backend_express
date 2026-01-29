import { Request, Response, NextFunction } from 'express';
import { userWorkOrderService } from './userWorkOrder.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../util/helper';
import mongoose from 'mongoose';
import { orderService } from '../../work/order/order.service';

class UserWorkOrderController {
  async getUserWorkOrders (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const match: any = {};
      const { workOrderId } = req.query;
      if(userRole === 'admin') {
        const workOrderData: any = await orderService.getAllOrders({ account_id, visible: true });
        if (!workOrderData || workOrderData.length === 0) {
          throw Object.assign(new Error('No data found'), { status: 404 });
        }
        match.woId = { $in: workOrderData.map((doc: any) => doc._id) };
      } else {
        match.userId = user_id;
      }
      if (workOrderId && mongoose.Types.ObjectId.isValid(String(workOrderId))) {
        const woId = helperService.validateObjectId(workOrderId);
        match.woId = woId;
        const workOrderData: any = await orderService.getAllOrders({ _id: woId , account_id, visible: true });
        if (!workOrderData || workOrderData.length === 0) {
          throw Object.assign(new Error('No data found'), { status: 404 });
        }
      }
      const data = await userWorkOrderService.getAll(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
  async getMappedData (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { workOrderId } = req.params;
      const woId = helperService.validateObjectId(workOrderId);
      const data = await userWorkOrderService.mappedData({ woId: woId });
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };
}

export const userWorkOrderController = new UserWorkOrderController();