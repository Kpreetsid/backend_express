import { Request, Response, NextFunction } from 'express';
import { orderService } from './order.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { storageProvider } from '../../_config/storage';
import { getExpectedSyncVersion, setSyncVersionEtag } from '../../utils/sync-concurrency';

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
      const { page = 1, limit = 15, pageType } = req.query;
      const pageNumber = Math.max(Number(page) || 1, 1);
      const limitNumber = Math.min(Math.max(Number(limit) || 15, 1), 100);
      const skip = (pageNumber - 1) * limitNumber;
      const normalizedQuery = { ...req.query, pageTYPE: pageType as string };

      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query: normalizedQuery
      });

      const { data, totalItems } = await orderService.getPaginatedWorkOrders(match, normalizedQuery, skip, limitNumber);

      res.status(200).json({
        status: true,
        message: "Work orders fetched successfully.",
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          totalItems,
          totalPages: totalItems > 0 ? Math.ceil(totalItems / limitNumber) : 0,
          hasNextPage: skip + limitNumber < totalItems,
          hasPrevPage: pageNumber > 1
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
      setSyncVersionEtag(res, data);
      res.status(200).json({ status: true, message: "Work order fetched.", data });
    } catch (error) {
      next(error);
    }
  }

  async createOrder(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const data = await orderService.createWorkOrder(req.body, user);
      setSyncVersionEtag(res, data);
      res.status(201).send({ status: true, message: 'Work order created.', data });
    } catch (error) {
      next(error);
    }
  }

  async updateOrder(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const id = String(req.params.id);
      const data = await orderService.updateById(id, req.body, user, getExpectedSyncVersion(req));
      setSyncVersionEtag(res, data);
      res.status(200).send({ status: true, message: 'Work order updated successfully.', data });
    } catch (error) {
      next(error);
    }
  }

  async statusUpdateOrder(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const id = String(req.params.id);
      const { status, block_reason } = req.body;
      const data = await orderService.orderStatusChange(id, status, user, block_reason, getExpectedSyncVersion(req));
      setSyncVersionEtag(res, data);
      res.status(200).send({ status: true, message: 'Work order updated successfully.', data });
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

      const data = await orderService.updateById(helperService.validateObjectId(String(id)), body, user, getExpectedSyncVersion(req));
      setSyncVersionEtag(res, data);
      res.status(200).send({ status: true, message: 'Work order updated successfully.', data });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const orderId = helperService.validateObjectId(String(req.params.id));
      await orderService.removeOrder(orderId, user);
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
        fileUrl: storageProvider.getURL(file.filename, String(req.params.folderName || '')),
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

  async getOverviewSummary(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const query = { ...(req.body || {}) };
      const fromDate = query.fromDate;
      const toDate = query.toDate;
      delete query.fromDate;
      delete query.toDate;

      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query
      });

      const data = await orderService.overviewSummaryData(match, { fromDate, toDate });
      res.status(200).json({ status: true, message: "Work order overview summary fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  async getCreatedVsCompleted(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const query = { ...(req.body || {}) };
      const fromDate = query.fromDate;
      const toDate = query.toDate;
      delete query.fromDate;
      delete query.toDate;

      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query
      });

      const data = await orderService.createdVsCompleted(match, { fromDate, toDate });
      res.status(200).json({ status: true, message: "Work order created vs completed fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  async getExecutionSummary(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const query = { ...(req.body || {}) };
      const fromDate = query.fromDate;
      const toDate = query.toDate;
      delete query.fromDate;
      delete query.toDate;

      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query
      });

      const data = await orderService.executionSummaryData(match, { fromDate, toDate });
      res.status(200).json({ status: true, message: "Work order execution summary fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  async getOnTimeVsOverdue(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const query = { ...(req.body || {}) };
      const fromDate = query.fromDate;
      const toDate = query.toDate;
      delete query.fromDate;
      delete query.toDate;

      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query
      });

      const data = await orderService.onTimeVsOverdue(match, { fromDate, toDate });
      res.status(200).json({ status: true, message: "Work order on-time vs overdue fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  async getTimeToComplete(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const query = { ...(req.body || {}) };
      const fromDate = query.fromDate;
      const toDate = query.toDate;
      delete query.fromDate;
      delete query.toDate;

      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query
      });

      const data = await orderService.timeToComplete(match, { fromDate, toDate });
      res.status(200).json({ status: true, message: "Work order time to complete fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  async getByType(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query: req.body
      });
      const data = await orderService.workOrdersByType(match);
      res.status(200).json({ status: true, message: "Work order type mix fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  async getSourceMix(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query: req.body
      });
      const data = await orderService.workOrderSourceMix(match);
      res.status(200).json({ status: true, message: "Work order source mix fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  async getAssetMaintenance(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query: req.body
      });
      const data = await orderService.assetMaintenanceReport(match);
      res.status(200).json({ status: true, message: "Asset maintenance report fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  async getRequestFunnel(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const query = { ...(req.body || {}) };
      const fromDate = query.fromDate;
      const toDate = query.toDate;
      delete query.fromDate;
      delete query.toDate;

      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query
      });
      const data = await orderService.requestFunnelReport(match, { fromDate, toDate });
      res.status(200).json({ status: true, message: "Request funnel report fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  async getPartsImpact(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const query = { ...(req.body || {}) };
      const fromDate = query.fromDate;
      const toDate = query.toDate;
      delete query.fromDate;
      delete query.toDate;

      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query
      });
      const data = await orderService.partsImpactReport(match, { fromDate, toDate });
      res.status(200).json({ status: true, message: "Parts impact report fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  async getCompletedWithInspection(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const query = { ...(req.body || {}) };
      const fromDate = query.fromDate;
      const toDate = query.toDate;
      delete query.fromDate;
      delete query.toDate;

      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query
      });

      const data = await orderService.completedWithInspectionReport(match, { fromDate, toDate });
      res.status(200).json({ status: true, message: "Completed with inspection report fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  async getCompletedByUser(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const query = { ...(req.body || {}) };
      const fromDate = query.fromDate;
      const toDate = query.toDate;
      delete query.fromDate;
      delete query.toDate;

      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query
      });

      const data = await orderService.completedByUserReport(match, { fromDate, toDate });
      res.status(200).json({ status: true, message: "Completed by user report fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  async getTimeVsCost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const query = { ...(req.body || {}) };
      const fromDate = query.fromDate;
      const toDate = query.toDate;
      delete query.fromDate;
      delete query.toDate;

      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query
      });

      const data = await orderService.timeVsCostReport(match, { fromDate, toDate });
      res.status(200).json({ status: true, message: "Time vs cost report fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  async getPlannerReadiness(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const query = { ...(req.body || {}) };
      const fromDate = query.fromDate;
      const toDate = query.toDate;
      delete query.fromDate;
      delete query.toDate;

      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query
      });

      const data = await orderService.plannerReadinessReport(match, { fromDate, toDate });
      res.status(200).json({ status: true, message: "Planner readiness report fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  async getRepeatingWorkOrders(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const query = { ...(req.body || {}) };
      const fromDate = query.fromDate;
      const toDate = query.toDate;
      delete query.fromDate;
      delete query.toDate;

      const match = await orderService.buildSearchMatch({
        account_id: user.account_id,
        user_id: String(user._id),
        user_role: user.user_role,
        query
      });

      const data = await orderService.repeatingWorkOrdersReport(match, { fromDate, toDate });
      res.status(200).json({ status: true, message: "Repeating work order report fetched successfully.", data });
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
      match.status = { $in: ['Open', 'Blocked', 'Waiting-on-Parts', 'Waiting-on-Permit', 'In-Progress', 'On-Hold'] };
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

  async getActivity(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const orderId = String(req.params.id);
      const data = await orderService.getActivity(orderId, account_id);
      res.status(200).json({ status: true, message: "Work order activity fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  }
}

export const orderController = new OrderController();
