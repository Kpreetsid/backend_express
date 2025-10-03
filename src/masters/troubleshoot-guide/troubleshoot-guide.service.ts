import { TroubleshootGuideModel } from "../../models/troubleshootGuide.model";
import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { IUser } from "../../models/user.model";

export const getAllTroubleshootGuide = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { account_id } = get(req, "user", {}) as IUser;
        const match = { account_id: account_id, visible: true };
        const data = await TroubleshootGuideModel.find(match);
        if (!data || data.length === 0) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
        next(error);
    }
};

export const getTroubleshootGuideById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        if (!req.params.id) {
            throw Object.assign(new Error('ID is required'), { status: 400 });
        }
        const { account_id } = get(req, "user", {}) as IUser;
        const match = { account_id: account_id, _id: req.params.id, visible: true };
        const data = await TroubleshootGuideModel.find(match);
        if (!data || data.length === 0) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
        next(error);
    }
};

export const insertTroubleshootGuide = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
        const body = req.body;
        const newTeam = new TroubleshootGuideModel({
            ...body,
            account_id: account_id,
            createdBy: user_id
        });
        const data = await newTeam.save();
        res.status(201).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
        next(error);
    }
};

export const updateTroubleshootGuideById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { params: { id }, body } = req;
        if (!id) {
            throw Object.assign(new Error('ID is required'), { status: 400 });
        }
        const data = await TroubleshootGuideModel.findByIdAndUpdate(id, body, { new: true });
        if (!data || !data.visible) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
        next(error);
    }
};

export const removeTroubleshootGuideById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        if (!req.params.id) {
            throw Object.assign(new Error('ID is required'), { status: 400 });
        }
        const data = await TroubleshootGuideModel.findById(req.params.id);
        if (!data || !data.visible) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        await TroubleshootGuideModel.findByIdAndUpdate(req.params.id, { visible: false }, { new: true });
        res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
        next(error);
    }
};