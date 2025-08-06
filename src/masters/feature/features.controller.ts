import { Request, Response, NextFunction } from "express";
import { getAllFeatures } from "./features.service";
import { get } from "lodash";
import { IUser } from "../../models/user.model";

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
        console.log({ account_id, user_id, userRole });
        const data = await getAllFeatures();
        if (!data || data.length === 0) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
        next(error);
    }
}