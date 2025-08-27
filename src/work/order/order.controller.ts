import { Request, Response, NextFunction } from 'express';
import { getAllOrders, getOrders, getDataById, insert, updateById, orderStatus, orderPriority, monthlyCount, plannedUnplanned, summaryData, pendingOrders, removeOrder } from './order.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { getMappedWorkOrderIDs } from '../../transaction/mapUserWorkOrder/userWorkOrder.service';
import mongoose from 'mongoose';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id };
    const { id, status, priority, order_no, wo_asset_id, location, assignedMe = false } = req.query;
    if (id) match._id = { $in: id.toString().split(',').map(id => new mongoose.Types.ObjectId(id)) };
    if (status) match.status = { $in: status.toString().split(',') };
    if (priority) match.priority = { $in: priority.toString().split(',') };
    if (order_no) match.order_no = { $in: order_no.toString().split(',') };
    if (location) match.wo_location_id = { $in: location.toString().split(',') };
    if (wo_asset_id) match.wo_asset_id = { $in: wo_asset_id.toString().split(',') };
    if (String(assignedMe) === "true" || userRole !== "admin") {
      match._id = { $in: await getMappedWorkOrderIDs(user_id) };
    }
    console.log({ match });
    const data = await getAllOrders(match);
    if(!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await getDataById(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const createOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const user = get(req, "user", {}) as IUser;
    const body = req.body;
    if(body.userIdList.length === 0) {
      throw Object.assign(new Error('User must be assigned to the work order'), { status: 400 });
    }
    const data = await insert(body, user);
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
    if(body?.userIdList?.length === 0) {
      throw Object.assign(new Error('User must be assigned to the work order'), { status: 400 });
    }
    const isWorkOrderExist: any = await getOrders({ _id: id, account_id });
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
    console.log({ account_id, user_id, userRole });
    await orderStatus(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const getOrderPriority = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await orderPriority(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const getMonthlyCount = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await monthlyCount(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const getPlannedUnplanned = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await plannedUnplanned(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const getSummaryData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await summaryData(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const getPendingOrders = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await pendingOrders(req, res, next);
  } catch (error) {
    next(error);
  }
}