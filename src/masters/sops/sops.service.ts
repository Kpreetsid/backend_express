import { Request, Response, NextFunction } from 'express';
import { SopsMasterModel, ISopsMaster } from '../../models/sops.model';
import { getData } from '../../util/queryBuilder';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { account_id, _id: user_id } = req.user;
        const match = { account_id: account_id, visible: true };
        const data: ISopsMaster[] = await getData(SopsMasterModel, { filter: match });
        if (!data || data.length === 0) {
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
        const { id } = req.params;
        if(!id) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        const { account_id, _id: user_id } = req.user;
        const match = { account_id: account_id, _id: id, visible: true };
        const data: ISopsMaster[] | null = await getData(SopsMasterModel, { filter: match });
        if (!data || data.length === 0) {
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
        const newSchedule = new SopsMasterModel(req.body);
        const data = await newSchedule.save();
        return res.status(201).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const data = await SopsMasterModel.findByIdAndUpdate(id, req.body, { new: true });
        if (!data || !data.visible) {
            throw Object.assign(new Error('No data found'), { status: 404 });
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
        const data = await SopsMasterModel.findById(id);
        if (!data || !data.visible) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        await SopsMasterModel.findByIdAndUpdate(id, { visible: false }, { new: true });
        return res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
        console.error(error);
        next(error);
    }
};