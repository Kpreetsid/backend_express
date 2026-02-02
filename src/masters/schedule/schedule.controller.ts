import { Request, Response, NextFunction } from 'express';
import { scheduleService } from './schedule.service';
import { IUser } from '../../models/user.model';
import { get } from 'lodash';
import { helperService } from '../../util/helper';

class ScheduleController {

  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const match: any = { account_id, visible: true };
      const { query: { priority, location_id, assignedUser } } = req;
      if (priority) match["work_order.priority"] = { $in: priority.toString().split(',') };
      if (location_id) match["work_order.wo_location_id"] = { $in: helperService.validateObjectIds(String(location_id)) };
      if (assignedUser) match["work_order.userIdList"] = { $in: assignedUser.toString().split(",") };
      if (userRole !== 'admin') {
        match["work_order.userIdList"] = { $in: [`${user_id}`] };
      }
      const data = await scheduleService.getSchedules(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async getDataById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const match: any = { _id: helperService.validateObjectId(String(id)), account_id, visible: true };
      if (userRole !== "admin") {
        match.createdBy = user_id;
      }
      const data = await scheduleService.getSchedules(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      console.error(error);
      next(error);
    }
  };

  async create(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const body = req.body;
      const data = await scheduleService.createSchedules(body, account_id, user_id);
      res.status(201).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      const existingData = await scheduleService.getSchedules({ _id: helperService.validateObjectId(String(id)), account_id: account_id, visible: true });
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const data = await scheduleService.updateSchedules(id, body, user_id);
      res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const existingData = await scheduleService.getSchedules({ _id: helperService.validateObjectId(String(id)), account_id: account_id, visible: true });
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const data = await scheduleService.removeSchedules(id, user_id);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const scheduleController = new ScheduleController();