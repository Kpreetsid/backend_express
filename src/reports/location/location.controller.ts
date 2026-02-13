import { Request, Response, NextFunction } from 'express';
import { locationReportService } from './location.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';

class LocationReportController {

  async getLocationsReport(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const match: any = { account_id };
      const { locationId } = req.query;
      if (locationId) {
        match.location_id = locationId;
      }
      const data = await locationReportService.getAll(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Location report not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  async createReport(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { location_id } = req.body;
      if (!location_id) {
        throw Object.assign(new Error('Invalid request data'), { status: 400 });
      }
      const data = await locationReportService.createLocationReport(location_id, user);
      if (!data) {
        throw Object.assign(new Error('Report not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Report created successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async deleteReport(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const result = await locationReportService.deleteLocationsReport(helperService.validateObjectId(String(id)), helperService.validateObjectId(String(account_id)), helperService.validateObjectId(String(user_id)));
      if (!result) {
        throw Object.assign(new Error('Report not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Report deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  async updateReport(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const data = await locationReportService.updateLocationReport(helperService.validateObjectId(String(id)), req.body, user);
      if (!data) {
        throw Object.assign(new Error('Report not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Report updated successfully", data });
    } catch (error) {
      next(error);
    }
  }
}

export const locationReportController = new LocationReportController();