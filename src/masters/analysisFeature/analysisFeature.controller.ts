import { NextFunction, Request, Response } from 'express';
import { IUser } from '../../models/user.model';
import { get } from "lodash";
import { analysisFeatureService } from './analysisFeature.service';


class AnalysisFeatureController {

    async getFeatureData(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const { account_id, user_role: userRole } = get(req, "user", {}) as IUser;
            if (userRole !== "admin") {
                throw Object.assign(new Error("Unauthorized"), { status: 401 });
            } else {
                const match = { account_id: account_id };
                const featureData = await analysisFeatureService.getFeatureData(match);
                if (!featureData) {
                    throw Object.assign(new Error("No feature data found"), { status: 404 });
                }
                res.status(200).json({ status: true, message: "Feature data retrieved successfully", data: featureData });
            }
        } catch (error) {
            next(error);
        }
    }

    async updateFeatureData(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const { user_role: userRole, _id: user_id } = get(req, "user", {}) as IUser;
            if (userRole !== "admin") {
                throw Object.assign(new Error("Unauthorized"), { status: 401 });
            } else {
                const { params: { id }, body } = req;
                const featureId = Array.isArray(id) ? id[0] : id;
                const updatedFeatureData = await analysisFeatureService.updateFeatureData(featureId, body, user_id);
                if (!updatedFeatureData) {
                    throw Object.assign(new Error("No feature data found"), { status: 404 });
                }
                res.status(200).json({ status: true, message: "Feature data updated successfully" });
            }
        } catch (error) {
            next(error);
        }
    }
}

export const analysisFeatureController = new AnalysisFeatureController()