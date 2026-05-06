import { Request, Response, NextFunction } from 'express';
import { userWorkOrderService } from './userWorkOrder.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { orderService } from '../../work/order/order.service';
import { notificationService } from '../../utils/notification.service';

class UserWorkOrderController {
  async getUserWorkOrders(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const match: any = {};
      const { workOrderId } = req.query;
      if (userRole === 'admin') {
        const workOrderData: any = await orderService.getAllOrders({ account_id, visible: true });
        if (!workOrderData || workOrderData.length === 0) {
          throw Object.assign(new Error('Work order not found'), { status: 404 });
        }
        match.woId = { $in: workOrderData.map((doc: any) => doc._id) };
      } else {
        match.userId = user_id;
      }
      if (workOrderId) {
        match.woId = helperService.validateObjectId(workOrderId);
        const workOrderData: any = await orderService.getAllOrders({ _id: match.woId, account_id, visible: true });
        if (!workOrderData || workOrderData.length === 0) {
          throw Object.assign(new Error('Work order not found'), { status: 404 });
        }
      }
      const data = await userWorkOrderService.getAll(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('User work order mapping not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "User work order mappings fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  async getMappedData(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { workOrderId } = req.params;
      const woId = helperService.validateObjectId(workOrderId);
      const data = await userWorkOrderService.mappedData({ woId: woId });
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Mapped data not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Mapped data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  async create(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { _id: user_id } = get(req, "user", {}) as IUser;
      const { body } = req;
      const validatedBody = body.map((item: any) => ({
        userId: helperService.validateObjectId(String(item.userId)),
        woId: helperService.validateObjectId(String(item.woId)),
        account_id: helperService.validateObjectId(String(item.account_id))
      }));
      const data = await userWorkOrderService.mapUsersWorkOrder(validatedBody);
      const firstMapping = validatedBody[0];
      if (firstMapping) {
        const orders = await orderService.getAllOrders({ _id: firstMapping.woId, account_id: firstMapping.account_id, visible: true });
        await notificationService.notifyAccountUsers({
          accountId: String(firstMapping.account_id),
          module: 'Work Order',
          event: 'updated',
          entityId: String(firstMapping.woId),
          entityName: orders[0]?.title || orders[0]?.order_no || 'Work Order',
          actionUrl: `/work-order/details/${firstMapping.woId}`,
          sourceUserId: String(user_id)
        });
      }
      res.status(200).json({ status: true, message: "Users mapped to work order successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { workOrderId } = req.params;
      const { userIds } = req.body;
      const woId = helperService.validateObjectId(workOrderId);
      if (!Array.isArray(userIds)) {
        throw Object.assign(new Error('Invalid request data'), { status: 400 });
      }
      const validatedUserIds = helperService.validateObjectIds(userIds.join(','));
      const data = await userWorkOrderService.updateMappedUsers(woId, validatedUserIds);
      const orders = await orderService.getAllOrders({ _id: woId, account_id, visible: true });
      await notificationService.notifyAccountUsers({
        accountId: String(account_id),
        module: 'Work Order',
        event: 'updated',
        entityId: String(workOrderId),
        entityName: orders[0]?.title || orders[0]?.order_no || 'Work Order',
        actionUrl: `/work-order/details/${workOrderId}`,
        sourceUserId: String(user_id)
      });
      res.status(200).json({ status: true, message: "User work order mapping updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { workOrderId } = req.params;
      const woId = helperService.validateObjectId(workOrderId);
      const data = await userWorkOrderService.removeMappedUsers(woId);
      res.status(200).json({ status: true, message: "User work order mapping removed successfully", data });
    } catch (error) {
      next(error);
    }
  }
}

export const userWorkOrderController = new UserWorkOrderController();
