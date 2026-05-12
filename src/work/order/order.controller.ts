import { Request, Response, NextFunction } from 'express';
import { orderService } from './order.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';

class OrderController {

  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query: req.query
      });

      const data = await orderService.getAllOrders(match);
      res.status(200).json({ status: true, message: "Work orders fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  }

  async getAllWorkOrders(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { page = 1, limit = 25, pageType } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query: { ...req.query, pageTYPE: pageType as string }
      });

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
      const orderId = helperService.validateObjectId(String(req.params.id));
      const data = await orderService.getAllOrders({ _id: orderId, account_id, visible: true });
      res.status(200).json({ status: true, message: "Work order fetched.", data });
    } catch (error) {
      next(error);
    }
  }

  async createOrder(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      if (!req.body.userIdList || req.body.userIdList.length === 0) {
        throw Object.assign(new Error('User must be assigned to the work order'), { status: 400 });
      }
      const data = await orderService.createWorkOrder(req.body, user);
      res.status(201).send({ status: true, message: 'Work order created.', data });
    } catch (error) {
      next(error);
    }
  }

  async updateOrder(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const id = String(req.params.id);
      if (req.body.hasOwnProperty('userIdList') && (!req.body.userIdList || req.body.userIdList.length === 0)) {
        throw Object.assign(new Error('User must be assigned to the work order'), { status: 400 });
      }
      const data = await orderService.updateById(id, req.body, user);
      res.status(200).send({ status: true, message: 'Work order updated successfully.', data });
    } catch (error) {
      next(error);
    }
  }

  async statusUpdateOrder(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const id = String(req.params.id);
      const { status } = req.body;
      await orderService.orderStatusChange(id, status, user);
      res.status(200).send({ status: true, message: 'Work order updated successfully.' });
    } catch (error) {
      next(error);
    }
  }

  async updateOrderSubmitData(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      
      if (!body || Object.keys(body).length === 0) {
        throw Object.assign(new Error('No data provided for update'), { status: 400 });
      }

      const data = await orderService.updateById(helperService.validateObjectId(String(id)), body, user);
      res.status(200).send({ status: true, message: 'Work order updated successfully.', data });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { _id: user_id } = get(req, "user", {}) as IUser;
      const orderId = helperService.validateObjectId(String(req.params.id));
      await orderService.removeOrder(orderId, user_id);
      res.status(200).send({ status: true, message: 'Work order deleted successfully.' });
    } catch (error) {
      next(error);
    }
  }

  async uploadAttachments(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const id = String(req.params.id);
      const orderId = helperService.validateObjectId(id);
      const files: any = req.files;

      if (!files || files.length === 0) {
        throw Object.assign(new Error('No files uploaded'), { status: 400 });
      }

      const orders = await orderService.getAllOrders({ _id: orderId, account_id: user.account_id, visible: true });
      const existingOrder = orders[0];

      const fileDataList = files.map((file: any) => ({
        originalName: file.originalname,
        type: file.mimetype,
        destination: file.destination,
        fileName: file.filename,
        folderName: req.params.folderName,
        fileUrl: `${req.protocol}://${req.get('host')}/${file.filename}`,
        filePath: file.path,
        size: file.size
      }));

      const newFiles = [...(existingOrder.files || []), ...fileDataList];
      await orderService.updateDataById(id, { files: newFiles }, user);
      
      res.status(200).send({ status: true, message: 'Attachments uploaded successfully.', data: newFiles });
    } catch (error) {
      next(error);
    }
  }

  async getOrderStatus(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query: req.body
      });
      const data = await orderService.orderStatus(match);
      res.status(200).json({ status: true, message: "Work order status fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  }

  async getOrderPriority(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query: req.body
      });
      const data = await orderService.orderPriority(match);
      res.status(200).json({ status: true, message: "Work order priority fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  }

  async getMonthlyCount(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query: req.body
      });
      const data = await orderService.monthlyCount(match);
      res.status(200).json({ status: true, message: "Work order monthly count fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  }

  async getPlannedUnplanned(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query: req.body
      });
      const data = await orderService.plannedUnplanned(match);
      res.status(200).json({ status: true, message: 'Work order planned/unplanned fetched successfully.', data });
    } catch (error) {
      next(error);
    }
  };

  async getSummaryData(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query: req.body
      });
      const data = await orderService.summaryData(match);
      res.status(200).json({ status: true, message: "Work order summary fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  async getPendingOrders(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query: req.body
      });
      match.status = { $in: ['Open', 'In-Progress', 'On-Hold'] };
      const data = await orderService.getAllOrders(match);
      res.status(200).json({ status: true, message: "Work order pending orders fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const orderId = String(req.params.id);
      const data = await orderService.getHistory(orderId);
      res.status(200).json({ status: true, message: "Work order history fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  }
}

export const orderController = new OrderController();