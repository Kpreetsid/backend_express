import { Request, Response, NextFunction } from 'express';
import { userWorkOrderService } from './userWorkOrder.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { orderService } from '../../work/order/order.service';
import { notificationService } from '../../utils/notification.service';
import { withTransaction } from '../../utils/transaction.helper';
import { ClientSession, Types } from 'mongoose';
import { requireActiveTenantUsers } from '../../utils/tenant-users';

const requireTenantWorkOrder = async (
  workOrderId: Types.ObjectId,
  accountId: Types.ObjectId,
  session?: ClientSession
): Promise<any> => {
  const orders = await orderService.getAllOrders({
    _id: workOrderId,
    account_id: accountId,
    visible: true
  }, session);
  if (!orders || orders.length === 0) {
    throw Object.assign(new Error('Work order not found'), { status: 404 });
  }
  return orders[0];
};

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
      const { account_id } = get(req, "user", {}) as IUser;
      const { workOrderId } = req.params;
      const woId = helperService.validateObjectId(workOrderId);
      await requireTenantWorkOrder(woId, account_id);
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
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { workOrderId, userIdList } = req.body;
      const woId = helperService.validateObjectId(String(workOrderId));
      const validatedUserIds = helperService.validateObjectIds(userIdList.join(','));
      const correlationId = String(res.locals['correlationId'] || '');
      const data = await withTransaction(async (session) => {
        const order = await requireTenantWorkOrder(woId, account_id, session);
        const tenantUserIds = await requireActiveTenantUsers(validatedUserIds, account_id, session);
        const mappings = tenantUserIds.map((userId) => ({ userId, woId }));
        const createdMappings = await userWorkOrderService.mapUsersWorkOrder(mappings, session);
        await notificationService.queueAccountNotification({
          accountId: String(account_id),
          module: 'Work Order',
          event: 'updated',
          entityId: String(woId),
          entityName: order.title || order.order_no || 'Work Order',
          actionUrl: `/work-order/details/${woId}`,
          sourceUserId: String(user_id)
        }, { session, correlationId });
        return createdMappings;
      });
      res.status(200).json({ status: true, message: "Users mapped to work order successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { workOrderId } = req.params;
      const { userIdList } = req.body;
      const woId = helperService.validateObjectId(workOrderId);
      if (!Array.isArray(userIdList)) {
        throw Object.assign(new Error('Invalid request data'), { status: 400 });
      }
      const validatedUserIds = helperService.validateObjectIds(userIdList.join(','));
      const correlationId = String(res.locals['correlationId'] || '');
      const data = await withTransaction(async (session) => {
        const order = await requireTenantWorkOrder(woId, account_id, session);
        const tenantUserIds = await requireActiveTenantUsers(validatedUserIds, account_id, session);
        const updatedMappings = await userWorkOrderService.updateMappedUsers(woId, tenantUserIds, session);
        await notificationService.queueAccountNotification({
          accountId: String(account_id),
          module: 'Work Order',
          event: 'updated',
          entityId: String(workOrderId),
          entityName: order.title || order.order_no || 'Work Order',
          actionUrl: `/work-order/details/${workOrderId}`,
          sourceUserId: String(user_id)
        }, { session, correlationId });
        return updatedMappings;
      });
      res.status(200).json({ status: true, message: "User work order mapping updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { workOrderId } = req.params;
      const woId = helperService.validateObjectId(workOrderId);
      await requireTenantWorkOrder(woId, account_id);
      const data = await userWorkOrderService.removeMappedUsers(woId);
      res.status(200).json({ status: true, message: "User work order mapping removed successfully", data });
    } catch (error) {
      next(error);
    }
  }
}

export const userWorkOrderController = new UserWorkOrderController();
