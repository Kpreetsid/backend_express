import { Request, Response, NextFunction } from 'express';
import { orderService } from './order.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { userWorkOrderService } from '../../transaction/mapUserWorkOrder/userWorkOrder.service';
import { helperService } from '../../utils/helper';

class OrderController {

  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, user_role: userRole, _id: user_id } = get(req, "user", {}) as IUser;
      const match: any = { account_id, visible: true };
      const { status, priority, wo_asset_id, wo_location_id, assignedUser } = req.query;
      if (status) match.status = { $in: status.toString().split(',') };
      if (priority) match.priority = { $in: priority.toString().split(',') };
      if (wo_asset_id) match.wo_asset_id = { $in: helperService.validateObjectIds(wo_asset_id.toString()) };
      if (wo_location_id) match.wo_location_id = { $in: helperService.validateObjectIds(wo_location_id.toString()) };
      const workOrderIds: any = [];
      if (assignedUser) {
        const validatedAssignedUsers = helperService.validateObjectIds(assignedUser.toString());
        for (const uid of validatedAssignedUsers) {
          workOrderIds.push(await userWorkOrderService.getMappedWorkOrderIDs(uid));
        }
        match._id = { $in: workOrderIds.flat() };
      }
      if (userRole !== 'admin') {
        const userWorkOrderIdList = await userWorkOrderService.getMappedWorkOrderIDs(user_id);
        if (!userWorkOrderIdList || userWorkOrderIdList.length === 0) {
          match.createdBy = user_id;
        } else {
          match.$or = [{ _id: { $in: userWorkOrderIdList } }, { createdBy: user_id }];
        }
      }
      const data = await orderService.getAllOrders(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Work order not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Work orders fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  }

  async getAllWorkOrders(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, user_role: userRole, _id: user_id } = get(req, "user", {}) as IUser;
      const { page = 1, limit = 25, pageType = "assignedToMe", status, priority, wo_asset_id, wo_location_id, assignedUser } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const match: any = { account_id, visible: true };
      if (status) {
        match.status = { $in: status.toString().split(",") };
      }
      if (priority) {
        match.priority = { $in: priority.toString().split(",") };
      }
      if (wo_asset_id) {
        match.wo_asset_id = { $in: helperService.validateObjectIds(wo_asset_id.toString()) };
      }
      if (wo_location_id) {
        match.wo_location_id = { $in: helperService.validateObjectIds(wo_location_id.toString()) };
      }
      if (assignedUser) {
        match["assignedUsers.userId"] = { $in: helperService.validateObjectIds(assignedUser.toString()) };
      }
      switch (pageType) {
        case "assignedToMe": {
          const ids = await userWorkOrderService.getMappedWorkOrderIDs(user_id);
          if (ids?.length) {
            match._id = { $in: ids };
          } else {
            match._id = { $in: [] };
          }
          break;
        }
        case "createdByMe": {
          match.createdBy = user_id;
          break;
        }
        case "openToAll": {
          match.createdBy = { $ne: user_id };
          if (!status) {
            match.status = { $in: ["Open", "In-Progress", "On-Hold"] };
          }
          const ids = await userWorkOrderService.getMappedWorkOrderIDs(user_id);
          if (ids?.length) {
            match._id = { $nin: ids };
          }
          break;
        }
        default: {
          if (userRole !== "admin") {
            const ids = await userWorkOrderService.getMappedWorkOrderIDs(user_id);
            match.$or = [
              { _id: { $in: ids || [] } },
              { createdBy: user_id }
            ];
          }
        }
      }
      const totalItems = await orderService.countOrders(match);
      const data = await orderService.getAllWorkOrders(match, skip, Number(limit));
      res.status(200).json({
        status: true,
        message: "Work orders fetched successfully.",
        pagination: {
          page: Number(page),
          limit: Number(limit),
          totalItems,
          totalPages: Math.ceil(totalItems / Number(limit)),
          hasNextPage: skip + Number(limit) < totalItems,
          hasPrevPage: Number(page) > 1
        },
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrderById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const orderId = helperService.validateObjectId(id);
      const data = await orderService.getAllOrders({ _id: orderId, account_id, visible: true });
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Work order not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Work order fetched.", data });
    } catch (error) {
      next(error);
    }
  }

  async createOrder(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const body = req.body;
      if (!body.userIdList || body.userIdList.length === 0) {
        throw Object.assign(new Error('User must be assigned to the work order'), { status: 400 });
      }
      const data = await orderService.createWorkOrder(body, user);
      if (!data) {
        throw Object.assign(new Error('Work order not created'), { status: 400 });
      }
      res.status(201).send({ status: true, message: 'Work order created.', data });
    } catch (error) {
      next(error);
    }
  }

  async updateOrder(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user: any = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      if (!body?.userIdList || body.userIdList?.length === 0) {
        throw Object.assign(new Error('User must be assigned to the work order'), { status: 400 });
      }
      const orderId = helperService.validateObjectId(id);
      const isWorkOrderExist: any = await orderService.getAllOrders({ _id: orderId, account_id: user.account_id, visible: true });
      if (!isWorkOrderExist && isWorkOrderExist.length === 0) {
        throw Object.assign(new Error('Work order not found'), { status: 404 });
      }
      await orderService.updateById(String(id), body, user);
      res.status(200).send({ status: true, message: 'Work order updated successfully.', data: body });
    } catch (error) {
      next(error);
    }
  }

  async updateOrderSubmitData(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user: any = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      if (!body?.task_submitted && !body?.sop_form_submitted) {
        throw Object.assign(new Error('No data submitted'), { status: 400 });
      }
      const orderId = helperService.validateObjectId(id);
      const filter = { _id: orderId, account_id: user.account_id, visible: true };
      const isWorkOrderExist: any = await orderService.getAllOrders(filter);
      if (!isWorkOrderExist && isWorkOrderExist.length === 0) {
        throw Object.assign(new Error('Work order not found'), { status: 404 });
      }
      if (body.task_submitted) {
        isWorkOrderExist[0].task_submitted = true;
        isWorkOrderExist[0].tasks = body.tasks;
      }
      if (body.sop_form_submitted) {
        isWorkOrderExist[0].sop_form_submitted = true;
        isWorkOrderExist[0].sop_form_data = body.sop_form_data;
      }
      await orderService.updateDataById(String(id), body, user);
      res.status(200).send({ status: true, message: 'Work order updated successfully.', data: body });
    } catch (error) {
      next(error);
    }
  }

  async statusUpdateOrder(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body: { status } } = req;
      const orderId = helperService.validateObjectId(id);
      const isWorkOrderExist: any = await orderService.getAllOrders({ _id: orderId, account_id, visible: true });
      if (!isWorkOrderExist && isWorkOrderExist.length === 0) {
        throw Object.assign(new Error('Work order not found'), { status: 404 });
      }
      if (status === 'Completed') {
        if (isWorkOrderExist[0].tasks?.length > 0) {
          if (!isWorkOrderExist[0].task_submitted) {
            throw Object.assign(new Error('Task is not completed'), { status: 400 });
          }
        }
        if (isWorkOrderExist[0].sop_form_id) {
          if (!isWorkOrderExist[0].sop_form_submitted) {
            throw Object.assign(new Error('Form is not completed'), { status: 400 });
          }
        }
        if (isWorkOrderExist[0].parts?.length > 0) {
          isWorkOrderExist[0].parts = isWorkOrderExist[0].parts.map((part: any) => {
            part.actualQuantity = part.estimatedQuantity;
            return part;
          });
        }
      } else if (status === 'Open') {
        isWorkOrderExist[0].task_submitted = false;
        isWorkOrderExist[0].sop_form_submitted = false;
      }
      const status_details = { status, createdBy: user_id };
      isWorkOrderExist[0].status_details = isWorkOrderExist[0]?.status_details || [];
      isWorkOrderExist[0]?.status_details.push(status_details);
      const body = { status, updatedBy: user_id, status_details: isWorkOrderExist[0].status_details, parts: isWorkOrderExist[0].parts };
      await orderService.orderStatusChange(id, body);
      res.status(200).send({ status: true, message: 'Work order updated successfully.' });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const orderId = helperService.validateObjectId(String(id));
      const data = await orderService.getAllOrders({ _id: orderId, account_id, visible: true });
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Work order not found'), { status: 404 });
      }
      await orderService.removeOrder(orderId, user_id);
      res.status(200).send({ status: true, message: 'Work order deleted successfully.' });
    } catch (error) {
      next(error);
    }
  }

  async getOrderStatus(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const match: any = { account_id: account_id, visible: true };
      const { wo_asset_id, fromDate, toDate } = req.body;
      if (wo_asset_id) {
        match.wo_asset_id = { $in: helperService.validateObjectIds(wo_asset_id.toString()) };
      }
      if (fromDate && toDate) {
        match.createdAt = { $gte: new Date(`${fromDate}`), $lte: new Date(`${toDate}`) };
      }
      const data = await orderService.orderStatus(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Work order not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Work order status fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  }

  async getOrderPriority(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const match: any = { account_id: account_id };
      const { wo_asset_id, fromDate, toDate } = req.body;
      if (wo_asset_id) {
        match.wo_asset_id = { $in: helperService.validateObjectIds(wo_asset_id.toString()) };
      }
      if (fromDate && toDate) {
        match.createdAt = { $gte: new Date(`${fromDate}`), $lte: new Date(`${toDate}`) };
      }
      const data = await orderService.orderPriority(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Work order not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Work order priority fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  }

  async getMonthlyCount(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const match: any = { account_id: account_id };
      const { wo_asset_id, fromDate, toDate } = req.body;
      if (wo_asset_id) {
        match.wo_asset_id = { $in: helperService.validateObjectIds(wo_asset_id.toString()) };
      }
      if (fromDate && toDate) {
        match.createdAt = { $gte: new Date(`${fromDate}`), $lte: new Date(`${toDate}`) };
      }
      const data = await orderService.monthlyCount(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Work order not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Work order monthly count fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  }

  async getPlannedUnplanned(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, 'user', {}) as IUser;
      const match: any = { account_id, visible: true };
      const { wo_asset_id, fromDate, toDate, order_no } = req.body;
      if (wo_asset_id) {
        const ids = helperService.validateObjectIds(wo_asset_id.toString());
        match.wo_asset_id = { $in: ids };
      }
      if (order_no) match.order_no = order_no;
      if (fromDate && toDate) {
        match.createdAt = { $gte: new Date(fromDate.toString()), $lte: new Date(toDate.toString()) };
      }
      const data = await orderService.plannedUnplanned(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Work order not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: 'Work order planned/unplanned fetched successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  async getSummaryData(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const { wo_asset_id, fromDate, toDate } = req.body;
      const workOrderMatch: any = { account_id, visible: true };
      if (wo_asset_id) {
        const assetIds = helperService.validateObjectIds(wo_asset_id.toString());
        workOrderMatch.wo_asset_id = { $in: assetIds };
      }
      if (fromDate && toDate) {
        const start = new Date(fromDate as string);
        const end = new Date(toDate as string);
        end.setHours(23, 59, 59, 999);
        workOrderMatch.createdAt = { $gte: start, $lte: end };
      }
      if (userRole !== 'admin') {
        const userWorkOrderIdList = await userWorkOrderService.getMappedWorkOrderIDs(user_id);
        if (!userWorkOrderIdList || userWorkOrderIdList.length === 0) {
          throw Object.assign(new Error('Work order not found'), { status: 404 });
        }
        workOrderMatch._id = { $in: userWorkOrderIdList };
      }
      const data = await orderService.summaryData(workOrderMatch);
      if (!data) {
        throw Object.assign(new Error('Work order not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Work order summary fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  async getPendingOrders(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const match: any = { account_id, visible: true };
      const { wo_asset_id, fromDate, toDate } = req.body;
      if (wo_asset_id) {
        match.wo_asset_id = { $in: helperService.validateObjectIds(wo_asset_id.toString()) };
      }
      if (fromDate && toDate) {
        match.createdAt = { $gte: new Date(`${fromDate}`), $lte: new Date(`${toDate}`) };
      }
      if (userRole !== 'admin') {
        const userWorkOrderIdList = await userWorkOrderService.getMappedWorkOrderIDs(user_id);
        if (!userWorkOrderIdList || userWorkOrderIdList.length === 0) {
          throw Object.assign(new Error('Work order not found'), { status: 404 });
        }
        match._id = { $in: userWorkOrderIdList };
      }
      match.status = { $in: ['Open', 'In-Progress', 'On-Hold'] };
      const data = await orderService.getAllOrders(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Work order not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Work order pending orders fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  }
}

export const orderController = new OrderController();