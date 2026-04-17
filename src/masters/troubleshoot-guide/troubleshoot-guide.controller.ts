import { Request, Response, NextFunction } from 'express';
import { troubleshootGuideService } from './troubleshoot-guide.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';

class TroubleshootGuideController {

    async getAllData(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const user = get(req, "user", {}) as IUser;
            const { account_id } = user;
            const baseFilter: any = { account_id: account_id, visible: true };
            const filter = await applyRoleFilter({
                user,
                baseFilter,
                accountField: "account_id",
                mapping: 'location',
                idField: 'locationId'
            });
            const data = await troubleshootGuideService.getAllTroubleshootGuide(filter);
            if (!data || data.length === 0) {
                throw Object.assign(new Error('Troubleshoot guide not found'), { status: 404 });
            }
            res.status(200).json({ status: true, message: "Troubleshoot guides fetched successfully", data });
        } catch (error) {
            next(error);
        }
    }

    async getDataByID(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const user = get(req, "user", {}) as IUser;
            const { account_id } = user;
            const { params: { id } } = req;
            const baseFilter: any = { _id: helperService.validateObjectId(String(id)), account_id: account_id, visible: true };
            const filter = await applyRoleFilter({
                user,
                baseFilter,
                accountField: "account_id",
                mapping: 'location',
                idField: 'locationId'
            });
            const data = await troubleshootGuideService.getAllTroubleshootGuide(filter);
            if (!data || data.length === 0) {
                throw Object.assign(new Error('Troubleshoot guide not found'), { status: 404 });
            }
            res.status(200).json({ status: true, message: "Troubleshoot guide fetched successfully", data });
        } catch (error) {
            next(error);
        }
    }

    async createData(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
            const data = await troubleshootGuideService.insertTroubleshootGuide(req.body, account_id, user_id);
            if (!data) {
                throw Object.assign(new Error('Troubleshoot guide not created'), { status: 404 });
            }
            res.status(200).json({ status: true, message: "Troubleshoot guide created successfully", data });
        } catch (error) {
            next(error);
        }
    }

    async updateData(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
            const { params: { id }, body } = req;
            const match: any = { _id: helperService.validateObjectId(String(id)), account_id: account_id, visible: true };
            const existingData = await troubleshootGuideService.getAllTroubleshootGuide(match);
            if (!existingData || existingData.length === 0) {
                throw Object.assign(new Error('Troubleshoot guide not found'), { status: 404 });
            }
            const data = await troubleshootGuideService.updateTroubleshootGuideById(id, body, user_id);
            if (!data) {
                throw Object.assign(new Error('Troubleshoot guide not updated'), { status: 404 });
            }
            res.status(200).json({ status: true, message: "Troubleshoot guide updated successfully", data });
        } catch (error) {
            next(error);
        }
    }

    async removeData(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
            const { params: { id } } = req;
            const match: any = { _id: helperService.validateObjectId(String(id)), account_id: account_id, visible: true };
            const existingData = await troubleshootGuideService.getAllTroubleshootGuide(match);
            if (!existingData || existingData.length === 0) {
                throw Object.assign(new Error('Troubleshoot guide not found'), { status: 404 });
            }
            const data = await troubleshootGuideService.removeTroubleshootGuideById(id, user_id);
            if (!data) {
                throw Object.assign(new Error('Troubleshoot guide not deleted'), { status: 404 });
            }
           return res.status(200).json({ status: true, message: "Troubleshoot guide deleted successfully" });
        } catch (error) {
            next(error);
        }
    }
}

export const troubleshootGuideController = new TroubleshootGuideController();