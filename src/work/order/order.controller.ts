import { Request, Response, NextFunction } from 'express';
import { getAllOrders, createWorkOrder, updateById, orderStatus, orderPriority, monthlyCount, plannedUnplanned, summaryData, pendingOrders, removeOrder, orderStatusChange } from './order.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { getMappedWorkOrderIDs } from '../../transaction/mapUserWorkOrder/userWorkOrder.service';
import mongoose from 'mongoose';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id} = get(req, "user", {}) as IUser;
    const match: any = { account_id };
    const { params: { id } } = req;
    const { status, priority, asset_id, location_id, assignedUser } = req.query;
    if (id) match._id = new mongoose.Types.ObjectId(id);
    if (status) match.status = { $in: status.toString().split(',') };
    if (priority) match.priority = { $in: priority.toString().split(',') };
    if (asset_id) match.wo_asset_id = { $in: asset_id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id)) };
    if (location_id) match.wo_location_id = { $in: location_id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id)) };
    const workOrderIds: any = [];
    if(assignedUser) {
      for(let i = 0; i < assignedUser.toString().split(',').length; i++) {
        workOrderIds.push(await getMappedWorkOrderIDs(assignedUser.toString().split(',')[i]));
      }
      match._id = { $in: workOrderIds.flat() };
    }
    const data = await getAllOrders(match);
    if(!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
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
    res.status(201).send({ status: true, message: 'Work order created successfully', data });
  } catch (error) {
    next(error);
  }
}

export const updateOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id }, body } = req;
    if(!body?.userIdList || body.userIdList?.length === 0) {
      throw Object.assign(new Error('User must be assigned to the work order'), { status: 400 });
    }
    const isWorkOrderExist: any = await getAllOrders({ _id: id, account_id });
    if (!isWorkOrderExist && isWorkOrderExist.length === 0) {
      throw Object.assign(new Error('Work order not found'), { status: 404 });
    }
    body.updatedBy = user_id;
    await updateById(id, body);
    res.status(200).send({ status: true, message: 'Work order updated successfully', data: body });
  } catch (error) {
    next(error);
  }
}

export const statusUpdateOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id }, body: { status } } = req;
    const isWorkOrderExist: any = await getAllOrders({ _id: new mongoose.Types.ObjectId(id), account_id });
    if (!isWorkOrderExist && isWorkOrderExist.length === 0) {
      throw Object.assign(new Error('Work order not found'), { status: 404 });
    }
    const body = { status, updatedBy: user_id };
    await orderStatusChange(id, body);
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
    const data = await getAllOrders({ _id: new mongoose.Types.ObjectId(id), account_id });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await removeOrder(req.params.id, user_id);
    res.status(200).send({ status: true, message: 'Work order removed successfully' });
  } catch (error) {
    next(error);
  }
}

export const getOrderStatus = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id };
    const { asset_id } = req.query;
    if (asset_id) {
      match.asset_id = { $in: asset_id.toString().split(',') };
    }
    if (userRole !== "admin") {
      match.user_id = user_id;
    }
    const data = await orderStatus(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getOrderPriority = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id };
    const { asset_id } = req.query;
    if (asset_id) {
      match.asset_id = { $in: asset_id.toString().split(',') };
    }
    if (userRole !== "admin") {
      match.user_id = user_id;
    }
    const data = await orderPriority(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getMonthlyCount = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id };
    const query = req.query;
    if (userRole !== 'admin') {
      match.user_id = user_id;
    }
    if (query.asset_id) {
      match.asset_id = { $in: query.asset_id.toString().split(',') };
    }
    const data = await monthlyCount(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getPlannedUnplanned = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id };
    const query = req.query;
    if (userRole !== 'admin') {
      match.user_id = user_id;
    }
    if (query.asset_id) {
      match.asset_id = { $in: query.asset_id.toString().split(',') };
    }
    if (query.order_no) {
      match.order_no = query.order_no;
    }
    const data = await plannedUnplanned(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getSummaryData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    const query = req.query;
    const match: any = { account_id: account_id, visible: true };
    if (userRole !== 'admin') {
      match.user_id = user_id;
    }
    if (query.asset_id) {
      match.asset_id = { $in: query.asset_id.toString().split(',') };
    }
    const data = await summaryData(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getPendingOrders = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query: any = req.query;
    const match: any = { account_id: account_id };
    if (userRole !== 'admin') {
      match.user_id = user_id;
    }
    if (query.asset_id) {
      match.asset_id = { $in: query.asset_id.toString().split(',') };
    }
    query.no_of_days = query.no_of_days || 30;
    var today = new Date();
    var priorDate = new Date(today.setDate(today.getDate() - query.no_of_days)).toISOString();
    match.createdOn = { $gte: priorDate };
    match.status = { $nin: ['Completed'] };
    const data = await pendingOrders(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}