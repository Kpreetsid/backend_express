import { Request, Response, NextFunction } from 'express';
import { getAllRequests, createRequest, updateRequest, deleteRequestById } from './request.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import mongoose from 'mongoose';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { query: { priority, location, status }} = req;
    let match: any = { account_id: account_id };
    if(priority) {
      match.priority = priority.toString().split(",").filter((p) => p !== "");
    }
    if(location) {
      match.locationId = location.toString().split(",").filter((l) => l !== "");
    }
    if(status) {
      match.status = status.toString().split(",").filter((s) => s !== "");
    }
    if(userRole !== 'admin') {
      match.created_by = user_id;
    }
    const data = await getAllRequests(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { params: { id }, query } = req;
    if(!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    let match: any = { _id: new mongoose.Types.ObjectId(id), account_id: account_id };
    if(query) {
      match = { ...match, ...query };
    }
    if(userRole !== 'admin') {
      match.created_by = user_id;
    }
    const data = await getAllRequests(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data: data[0] });
  } catch (error) {
    next(error);
  }
}

export const create = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const user = get(req, "user", {}) as IUser;
    const body = req.body;
    const data = await createRequest(body, user);
    res.status(200).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
}

export const update = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    const { params: { id }, body } = req;
    if(!id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id: account_id };
    const existingRequest = await getAllRequests(match);
    if (!existingRequest || existingRequest.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await updateRequest(id, body, user_id);
    res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);
  }
}

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    const { params: { id } } = req;
    if(!id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id: account_id };
    const existingRequest = await getAllRequests(match);
    if (!existingRequest || existingRequest.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await deleteRequestById(id, user_id);
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
}