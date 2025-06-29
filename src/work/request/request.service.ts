import { WorkRequestModel, IWorkRequest } from "../../models/workRequest.model";
import { Request, Response, NextFunction } from 'express';
import { getData } from "../../util/queryBuilder";
import { get } from "lodash";
import { IUser } from "../../models/user.model";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const query = req.query;
    let match: any = { account_id: account_id };
    if(query) {
      match = { ...match, ...query };
    }
    if(userRole !== 'admin') {
      match.created_by = user_id;
    }
    const data: IWorkRequest[] | null = await getData(WorkRequestModel, { filter: match });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if(!id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match = { account_id: account_id, _id: id, visible: true };
    const data: IWorkRequest[] | null = await getData(WorkRequestModel, { filter: match });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const body = req.body;
    body.account_id = account_id;
    body.createdBy = user_id;
    const newWorkRequest = new WorkRequestModel(body);
    const data = await newWorkRequest.save();
    res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { params, body } = req;
    if(!params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    body.updatedBy = user_id;
    const data = await WorkRequestModel.findByIdAndUpdate(params.id, body, { new: true });
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if(!id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await WorkRequestModel.findById(id);
    if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await WorkRequestModel.findByIdAndUpdate(id, { visible: false }, { new: true });
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};