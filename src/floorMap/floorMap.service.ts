import { EndpointLocation } from "../models/floorMap.model";
import e, { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = req.user;
    const data = await EndpointLocation.find({});
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const data = await EndpointLocation.findById(id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const endpointLocation = new EndpointLocation(req.body);
    await endpointLocation.save();
    return res.status(201).json({ status: true, message: "Data inserted successfully", data: endpointLocation });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const { name, description, location } = req.body;
    const data = await EndpointLocation.findByIdAndUpdate(id, { name, description, location }, { new: true });
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const removeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const data = await EndpointLocation.findById(id);
    if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await EndpointLocation.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};