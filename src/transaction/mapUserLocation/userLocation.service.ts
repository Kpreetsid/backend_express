import { MapUserLocation, IMapUserLocation } from "../../models/mapUserLocation.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = req.user;
    const data = await MapUserLocation.find({account_id: account_id}).sort({ _id: -1 });
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};