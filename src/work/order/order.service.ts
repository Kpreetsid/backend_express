import mongoose from "mongoose";
import { WorkOrder, IWorkOrder } from "../../_models/workOrder.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = req.user;
    const data = await WorkOrder.find({account_id: account_id, visible: true}).sort({ _id: -1 });
    if (data.length === 0) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = await WorkOrder.findById(id);
    if (!data) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) { 
    console.error(error);
    next(error);
  }
};

export const accountWise = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id } = req.user;
    const data: IWorkOrder[] | null = await WorkOrder.find({account_id: account_id, visible: true}).sort({ _id: -1 });
    if (data.length === 0) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) { 
    console.error(error);
    next(error);
  }
};

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await WorkOrder.create(req.body);
    return res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { body } = req;
    const data = await WorkOrder.findByIdAndUpdate(id, body, { new: true });
    if (!data) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = await WorkOrder.findById(id);
    if (!data) {
        const error = new Error("Data not found");
        (error as any).status = 404;
        throw error;
    }
    if(!data.visible) {
        const error = new Error("Data already deleted");
        (error as any).status = 400;
        throw error;
    }
    await WorkOrder.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};