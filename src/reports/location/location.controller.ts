import { Request, Response, NextFunction } from 'express';
import { locationReportService } from './location.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import mongoose from 'mongoose';

class LocationReportController {

  async getLocationsReport (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const match: any = { account_id };
      const { locationId } = req.query;
      if(locationId) {
        match.location_id = locationId;
      }
      const data = await locationReportService.getAll(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
  async createReport (req: Request, res: Response, next: NextFunction): Promise<any> {
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
  
  async deleteReport (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }} = req;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw Object.assign(new Error('Invalid request data'), { status: 400 });
      }
      const result = await locationReportService.deleteLocationsReport(id, `${account_id}`, `${user_id}`);
      if (!result) {
        throw Object.assign(new Error('Report not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Report deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const locationReportController = new LocationReportController();