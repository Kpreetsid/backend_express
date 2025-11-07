import { Request, Response, NextFunction } from 'express';
import { getAllOrders, createWorkOrder, updateById, orderStatus, orderPriority, monthlyCount, plannedUnplanned, summaryData, removeOrder, orderStatusChange } from './order.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { getMappedWorkOrderIDs } from '../../transaction/mapUserWorkOrder/userWorkOrder.service';
import mongoose from 'mongoose';
import { redisGet, redisSet, redisDelete, redisDeletePattern, buildCacheKey } from '../../_redis/redis.operation';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, user_role: userRole, _id: user_id } = get(req, "user", {}) as IUser;
    const cacheKey = buildCacheKey("orders", `${account_id}`, JSON.stringify(req.query));
    const cached = await redisGet(cacheKey);
    if (cached) {
      res.status(200).json({ status: true, message: "Work orders fetched successfully.", cached: true, data: cached });
      return;
    }
    const match: any = { account_id, visible: true };
    const { status, priority, wo_asset_id, wo_location_id, assignedUser } = req.query;
    if (status) match.status = { $in: status.toString().split(',') };
    if (priority) match.priority = { $in: priority.toString().split(',') };
    if (wo_asset_id) match.wo_asset_id = { $in: wo_asset_id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id)) };
    if (wo_location_id) match.wo_location_id = { $in: wo_location_id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id)) };
    const workOrderIds: any = [];
    if(assignedUser) {
      for(let i = 0; i < assignedUser.toString().split(',').length; i++) {
        workOrderIds.push(await getMappedWorkOrderIDs(assignedUser.toString().split(',')[i]));
      }
      match._id = { $in: workOrderIds.flat() };
    }
    if(userRole !== 'admin') {
      const userWorkOrderIdList = await getMappedWorkOrderIDs(user_id);
      if(!userWorkOrderIdList || userWorkOrderIdList.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });  
      }
      match._id = { $in: userWorkOrderIdList };
    }
    const data = await getAllOrders(match);
    if(!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await redisSet(cacheKey, data, 600);
    res.status(200).json({ status: true, message: "Work orders fetched successfully.", data });
  } catch (error) {
    next(error);
  }
}

export const getOrderById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const { params: { id } } = req;
    if (!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const cacheKey = buildCacheKey("order", id);
    const cached = await redisGet(cacheKey);
    if (cached) {
      res.status(200).json({ status: true, message: "Work order fetched successfully.", cached: true, data: cached });
      return;
    }
    const data = await getAllOrders({ _id: new mongoose.Types.ObjectId(id), account_id, visible: true });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await redisSet(cacheKey, data, 600);
    res.status(200).json({ status: true, message: "Work order fetched successfully.", data });
  } catch (error) {
    next(error);
  }
}

export const createOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const user = get(req, "user", {}) as IUser;
    const body = req.body;
    if(!body.userIdList || body.userIdList.length === 0) {
      throw Object.assign(new Error('User must be assigned to the work order'), { status: 400 });
    }
    const data = await createWorkOrder(body, user);
    if (!data) {
      throw Object.assign(new Error('Failed to create work order'), { status: 400 });
    }
    await redisDeletePattern(buildCacheKey("orders", `${user.account_id}`, "*"));
    res.status(201).send({ status: true, message: 'Work order created successfully', data });
  } catch (error) {
    next(error);
  }
}

export const updateOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const user: any = get(req, "user", {}) as IUser;
    const { params: { id }, body } = req;
    if(!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    if(!body?.userIdList || body.userIdList?.length === 0) {
      throw Object.assign(new Error('User must be assigned to the work order'), { status: 400 });
    }
    const isWorkOrderExist: any = await getAllOrders({ _id: new mongoose.Types.ObjectId(id), account_id: user.account_id, visible: true });
    if (!isWorkOrderExist && isWorkOrderExist.length === 0) {
      throw Object.assign(new Error('Work order not found'), { status: 404 });
    }
    await updateById(id, body, user);
    await redisDelete(buildCacheKey("order", id));
    await redisDeletePattern(buildCacheKey("orders", `${user.account_id}`, "*"));
    res.status(200).send({ status: true, message: 'Work order updated successfully', data: body });
  } catch (error) {
    next(error);
  }
}

export const statusUpdateOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id }, body: { status } } = req;
    const isWorkOrderExist: any = await getAllOrders({ _id: new mongoose.Types.ObjectId(id), account_id, visible: true });
    if (!isWorkOrderExist && isWorkOrderExist.length === 0) {
      throw Object.assign(new Error('Work order not found'), { status: 404 });
    }
    if(status === 'Completed') {
      if(isWorkOrderExist[0].tasks?.length > 0) {
        if(!isWorkOrderExist[0].task_submitted) {
          throw Object.assign(new Error('Task is not completed'), { status: 400 });
        }
      }
      if(isWorkOrderExist[0].sop_form_id) {
        if(!isWorkOrderExist[0].sop_form_data) {
          throw Object.assign(new Error('Form is not completed'), { status: 400 });
        }
      }
    }
    const body = { status, updatedBy: user_id };
    await orderStatusChange(id, body);
    await redisDelete(buildCacheKey("order", id));
    await redisDeletePattern(buildCacheKey("orders", `${account_id}`, "*"));
    res.status(200).send({ status: true, message: 'Work order updated successfully' });
  } catch (error) {
    next(error);
  }
}

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id } } = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const data = await getAllOrders({ _id: new mongoose.Types.ObjectId(id), account_id, visible: true });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await removeOrder(req.params.id, user_id);
    await redisDelete(buildCacheKey("order", id));
    await redisDeletePattern(buildCacheKey("orders", `${account_id}`, "*"));
    res.status(200).send({ status: true, message: 'Work order removed successfully' });
  } catch (error) {
    next(error);
  }
}

export const getOrderStatus = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id, visible: true };
    const cacheKey = buildCacheKey("orders:status", `${account_id}`, JSON.stringify(req.query));
    const cached = await redisGet(cacheKey);
    if (cached) {
      res.status(200).json({ status: true, message: "Work order status fetched successfully.", cached: true, data: cached });
      return;
    }
    const { wo_asset_id, fromDate, toDate } = req.query;
    if (wo_asset_id) {
      match.wo_asset_id = { $in: wo_asset_id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id)) };
    }
    if (fromDate && toDate) {
      match.createdAt = { $gte: new Date(`${fromDate}`), $lte: new Date(`${toDate}`) };
    }
    const data = await orderStatus(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await redisSet(cacheKey, data, 600);
    res.status(200).json({ status: true, message: "Work order status fetched successfully.", data });
  } catch (error) {
    next(error);
  }
}

export const getOrderPriority = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id };
    const cacheKey = buildCacheKey("orders:priority", `${account_id}`, JSON.stringify(req.query));
    const cached = await redisGet(cacheKey);
    if (cached) {
      res.status(200).json({ status: true, message: "Work order priority fetched successfully.", cached: true, data: cached });
      return;
    }
    const { wo_asset_id, fromDate, toDate } = req.query;
    if (wo_asset_id) {
      match.wo_asset_id = { $in: wo_asset_id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id)) };
    }
    if (fromDate && toDate) {
      match.createdAt = { $gte: new Date(`${fromDate}`), $lte: new Date(`${toDate}`) };
    }
    const data = await orderPriority(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await redisSet(cacheKey, data, 600);
    res.status(200).json({ status: true, message: "Work order priority fetched successfully.", data });
  } catch (error) {
    next(error);
  }
}

export const getMonthlyCount = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const cacheKey = buildCacheKey("orders:monthly", `${account_id}`, JSON.stringify(req.query));
    const cached = await redisGet(cacheKey);
    if (cached) {
      res.status(200).json({ status: true, message: "Work order monthly count fetched successfully.", cached: true, data: cached });
      return;
    } 
    const match: any = { account_id: account_id };
    const { wo_asset_id, fromDate, toDate } = req.query;
    if (wo_asset_id) {
      match.wo_asset_id = { $in: wo_asset_id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id)) };
    }
    if (fromDate && toDate) {
      match.createdAt = { $gte: new Date(`${fromDate}`), $lte: new Date(`${toDate}`) };
    }
    const data = await monthlyCount(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await redisSet(cacheKey, data, 600);
    res.status(200).json({ status: true, message: "Work order monthly count fetched successfully.", data });
  } catch (error) {
    next(error);
  }
}

export const getPlannedUnplanned = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const cacheKey = buildCacheKey("orders:planned", `${account_id}`, JSON.stringify(req.query));
    const cached = await redisGet(cacheKey);
    if (cached) {
      res.status(200).json({ status: true, message: "Work order planned/unplanned fetched successfully.", cached: true, data: cached });
      return;
    } 
    const match: any = { account_id: account_id };
    const { wo_asset_id, fromDate, toDate, order_no } = req.query;
    if (wo_asset_id) {
      match.wo_asset_id = { $in: wo_asset_id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id)) };
    }
    if (order_no) {
      match.order_no = order_no;
    }
    if (fromDate && toDate) {
      match.createdAt = { $gte: new Date(`${fromDate}`), $lte: new Date(`${toDate}`) };
    }
    const data = await plannedUnplanned(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await redisSet(cacheKey, data, 600);
    res.status(200).json({ status: true, message: "Work order planned/unplanned fetched successfully.", data });
  } catch (error) {
    next(error);
  }
}

export const getSummaryData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const cacheKey = buildCacheKey("orders:summary", `${account_id}`, JSON.stringify(req.query));
    const cached = await redisGet(cacheKey);
    if (cached) {
      res.status(200).json({ status: true, message: "Work order summary data fetched successfully.", cached: true, data: cached });
      return;
    } 
    const match: any = { account_id: account_id, visible: true };
    const { wo_asset_id, fromDate, toDate } = req.query;
    if (wo_asset_id) {
      match.wo_asset_id = { $in: wo_asset_id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id)) };
    }
    if (fromDate && toDate) {
      match.createdAt = { $gte: new Date(`${fromDate}`), $lte: new Date(`${toDate}`) };
    }
    const data = await summaryData(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await redisSet(cacheKey, data, 600);
    res.status(200).json({ status: true, message: "Work order summary data fetched successfully.", data });
  } catch (error) {
    next(error);
  }
}

export const getPendingOrders = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const cacheKey = buildCacheKey("orders:pending", `${account_id}`, JSON.stringify(req.query));
    const cached = await redisGet(cacheKey);
    if (cached) {
      res.status(200).json({ status: true, message: "Work order pending orders fetched successfully.", cached: true, data: cached });
      return;
    } 
    const match: any = { account_id, visible: true };
    const { wo_asset_id, fromDate, toDate } = req.query;
    if (wo_asset_id) {
      match.wo_asset_id = { $in: wo_asset_id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id)) };
    }
    if (fromDate && toDate) {
      match.createdAt = { $gte: new Date(`${fromDate}`), $lte: new Date(`${toDate}`) };
    }
    match.status = { $in: ['Open', 'In-Progress', 'On-Hold'] };
    const data = await getAllOrders(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await redisSet(cacheKey, data, 600);
    res.status(200).json({ status: true, message: "Work order pending orders fetched successfully.", data });
  } catch (error) {
    next(error);
  }
}