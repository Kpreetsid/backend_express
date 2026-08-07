import { Request, Response, NextFunction } from 'express';
import { troubleshootGuideService } from './troubleshoot-guide.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';
import { requireTenantReferences } from '../../utils/tenant-references';

class TroubleshootGuideController {

    async getAllData(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const user = get(req, "user", {}) as IUser;
            const { assetId, locationId } = req.query;
            const baseFilter: any = {};
            if (assetId) {
                baseFilter.assetId = helperService.validateObjectId(String(assetId));
            }
            if (locationId) {
                baseFilter.locationId = helperService.validateObjectId(String(locationId));
            }
            const mapping = assetId ? 'asset' : locationId ? 'location' : '';
            const idField = assetId ? 'assetId' : locationId ? 'locationId' : '_id';
            const filter = await applyRoleFilter({
                user,
                baseFilter,
                accountField: "account_id",
                mapping,
                idField
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
            const { params: { id } } = req;
            const baseFilter: any = { _id: helperService.validateObjectId(String(id)) };
            const filter = await applyRoleFilter({
                user,
                baseFilter,
                accountField: "account_id"
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
            await requireTenantReferences(req.body, account_id);
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
            await requireTenantReferences(body, account_id);
            const data = await troubleshootGuideService.updateTroubleshootGuideById(id, body, account_id, user_id);
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
            const data = await troubleshootGuideService.removeTroubleshootGuideById(id, account_id, user_id);
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
