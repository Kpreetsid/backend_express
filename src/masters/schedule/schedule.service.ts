import { ScheduleMasterModel, IScheduleMaster } from "../../models/scheduleMaster.model";
import { Request, Response, NextFunction } from 'express';
import { get } from "lodash";
import { IUser } from "../../models/user.model";

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
        const match: any = { account_id: account_id, visible: true };
        if (userRole !== 'admin') {
            match.user_id = user_id;
        }
        const data: IScheduleMaster[] = await ScheduleMasterModel.find(match);
        if (!data || data.length === 0) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        return res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
        next(error);
    }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        if(!req.params.id) {
            throw Object.assign(new Error('ID is required'), { status: 400 });
        }
        const { account_id } = get(req, "user", {}) as IUser;
        const match = { account_id: account_id, _id: req.params.id, visible: true };
        const data: IScheduleMaster[] = await ScheduleMasterModel.find(match);
        if (!data || data.length === 0) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        return res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
        next(error);
    }
};

export const insert = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const newSchedule = new ScheduleMasterModel(req.body);
        const data = await newSchedule.save();
        return res.status(201).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
        next(error);
    }
};

export const updateById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { params: { id }, body } = req;
        if (!id) {
            throw Object.assign(new Error('ID is required'), { status: 400 });
        }
        const data = await ScheduleMasterModel.findByIdAndUpdate(id, body, { new: true });
        if (!data || !data.visible) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        return res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
        next(error);
    }
};

export const removeById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        if (!req.params.id) {
            throw Object.assign(new Error('ID is required'), { status: 400 });
        }
        const data = await ScheduleMasterModel.findById(req.params.id);
        if (!data || !data.visible) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        await ScheduleMasterModel.findByIdAndUpdate(req.params.id, { visible: false }, { new: true });
        return res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
        next(error);
    }
};