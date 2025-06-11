import { Teams, ITeam } from "../../models/team.model";
import { NextFunction, Request, Response } from 'express';
import { getData } from "../../util/queryBuilder";
import { get } from "lodash";
import { IUser } from "../../models/user.model";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
         const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
        const match = { account_id: account_id, isActive: true };
        const data: ITeam[] = await getData(Teams, { filter: match });
        if (!data || data.length === 0) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
         const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
        const match = { account_id: account_id, _id: id, isActive: true };
        const data = await getData(Teams, { filter: match });
        if (!data || data.length === 0) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const insert = async (req: Request, res: Response, next: NextFunction) => {
    try {
         const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
        const body = req.body;
        const newTeam = new Teams({
            team_name: body.team_name,
            account_id: account_id,
            createdBy: user_id
        });
        const data = await newTeam.save();
        res.status(201).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const data = await Teams.findByIdAndUpdate(id, req.body, { new: true });
        if (!data || !data.isActive) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const removeById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const data = await Teams.findById(id);
        if (!data || !data.isActive) {
            throw Object.assign(new Error('No data found'), { status: 404 });
        }
        await Teams.findByIdAndUpdate(id, { isActive: false }, { new: true });
        res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
        console.error(error);
        next(error);
    }
};