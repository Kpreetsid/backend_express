import { Request, Response, NextFunction } from "express";
import { getAllFeatures } from "./features.service";

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const data = await getAllFeatures();
        if (!data || data.length === 0) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
        next(error);
    }
}