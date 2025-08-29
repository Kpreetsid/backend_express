import { TeamsModel } from "../../models/team.model";
import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { IUser } from "../../models/user.model";

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
         const { account_id } = get(req, "user", {}) as IUser;
        const match = { account_id: account_id, isActive: true };
        const data = await TeamsModel.find(match);
        if (!data || data.length === 0) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
        next(error);
    }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        if (!req.params.id) {
            throw Object.assign(new Error('ID is required'), { status: 400 });
        }
        const { account_id } = get(req, "user", {}) as IUser;
        const match = { account_id: account_id, _id: req.params.id, isActive: true };
        const data = await TeamsModel.find(match);
        if (!data || data.length === 0) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
        next(error);
    }
};

export const insert = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
         const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
        const body = req.body;
        const newTeam = new TeamsModel({
            team_name: body.team_name,
            account_id: account_id,
            createdBy: user_id
        });
        const data = await newTeam.save();
        res.status(201).json({ status: true, message: "Data created successfully", data });
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
        const data = await TeamsModel.findByIdAndUpdate(id, body, { new: true });
        if (!data || !data.isActive) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
        next(error);
    }
};

export const removeById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        if (!req.params.id) {
            throw Object.assign(new Error('ID is required'), { status: 400 });
        }
        const data = await TeamsModel.findById(req.params.id);
        if (!data || !data.isActive) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        await TeamsModel.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
        res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
        next(error);
    }
};