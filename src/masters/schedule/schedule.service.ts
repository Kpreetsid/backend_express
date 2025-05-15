import { ScheduleMasterModel, IScheduleMaster } from "../../_models/scheduleMaster.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data: IScheduleMaster[] | null = await ScheduleMasterModel.find({}).sort({ _id: -1 });
        if (!data || data.length === 0) {
            const error = new Error("No data found");
            (error as any).status = 404;
            throw error;
        }
        console.log(data.length);
        return res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const data = await ScheduleMasterModel.findById(id);
        if (!data) {
            const error = new Error("Data not found");
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
        const newSchedule = new ScheduleMasterModel(req.body);
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
        const data = await ScheduleMasterModel.findByIdAndUpdate(id, req.body, { new: true });
        if (!data) {
            const error = new Error("Data not found");
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
        const data = await ScheduleMasterModel.findById(id);
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
        await ScheduleMasterModel.findByIdAndUpdate(id, { visible: false }, { new: true });
        return res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
        console.error(error);
        next(error);
    }
};