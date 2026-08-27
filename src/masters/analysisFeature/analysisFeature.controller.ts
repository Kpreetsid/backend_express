import { NextFunction, Request, Response } from 'express';
import { IUser } from '../../models/user.model';
import { get } from "lodash";
import { analysisFeatureService } from './analysisFeature.service';


class AnalysisFeatureController {

    async getFeatureData(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const user = get(req, "user", {}) as IUser;
            this.assertAccountAdmin(user);
            const featureData = await analysisFeatureService.getOrCreateFeatureData(user.account_id, user._id);
            res.status(200).json({ status: true, message: "Feature data retrieved successfully", data: featureData });
        } catch (error) {
            next(error);
        }
    }

    async updateFeatureData(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const user = get(req, "user", {}) as IUser;
            this.assertAccountAdmin(user);
            const { params: { id }, body } = req;
            const featureId = Array.isArray(id) ? id[0] : id;
            const updatedFeatureData = await analysisFeatureService.updateFeatureData(
                featureId,
                user.account_id,
                body.featuresJson,
                user._id
            );
            if (!updatedFeatureData) {
                throw Object.assign(new Error("No feature data found for this account"), { status: 404 });
            }
            res.status(200).json({ status: true, message: "Feature data updated successfully", data: updatedFeatureData });
        } catch (error) {
            next(error);
        }
    }

    private assertAccountAdmin(user: IUser): void {
        if (!user?._id || user.user_role !== 'admin') {
            throw Object.assign(new Error('Account administrator access is required'), { status: 403 });
        }
    }
}

export const analysisFeatureController = new AnalysisFeatureController()
