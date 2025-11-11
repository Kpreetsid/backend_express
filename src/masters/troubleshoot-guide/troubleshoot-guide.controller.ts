import { Request, Response, NextFunction } from 'express';
import { getAllTroubleshootGuide, insertTroubleshootGuide, updateTroubleshootGuideById, removeTroubleshootGuideById } from './troubleshoot-guide.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import mongoose from 'mongoose';

export const getAllData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { account_id } = get(req, "user", {}) as IUser;
        const match: any = { account_id: account_id, visible: true };
        const data = await getAllTroubleshootGuide(match);
        if (!data || data.length === 0) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
        next(error);
    }
}

export const getDataByID = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { account_id } = get(req, "user", {}) as IUser;
        const { params: { id } } = req;
        if (!id) {
            throw Object.assign(new Error('Bad request'), { status: 400 });
        }
        const match: any = { _id: new mongoose.Types.ObjectId(id), account_id: account_id, visible: true };
        const data = await getAllTroubleshootGuide(match);
        if (!data || data.length === 0) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
        next(error);
    }
}

export const createData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
        const data = await insertTroubleshootGuide(req.body, account_id, user_id);
        if (!data) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
        next(error);
    }
}

export const updateData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
        const { params: { id }, body } = req;
        if (!id) {
            throw Object.assign(new Error('Bad request'), { status: 400 });
        }
        const match: any = { _id: new mongoose.Types.ObjectId(id), account_id: account_id, visible: true };
        const existingData = await getAllTroubleshootGuide(match);
        if (!existingData || existingData.length === 0) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        const data = await updateTroubleshootGuideById(id, body, user_id);
        if (!data) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
        next(error);
    }
}

export const removeData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
        const { params: { id } } = req;
        if (!id) {
            throw Object.assign(new Error('Bad request'), { status: 400 });
        }
        const match: any = { _id: new mongoose.Types.ObjectId(id), account_id: account_id, visible: true };
        const existingData = await getAllTroubleshootGuide(match);
        if (!existingData || existingData.length === 0) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        const data = await removeTroubleshootGuideById(id, user_id);
        if (!data) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
        next(error);
    }
}
