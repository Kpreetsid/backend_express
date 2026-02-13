import { Request, Response, NextFunction } from 'express';
import { scheduleService } from './schedule.service';
import { IUser } from '../../models/user.model';
import { get } from 'lodash';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';

class ScheduleController {

  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const baseFilter: any = { account_id, visible: true };
      const { query: { priority, location_id, assignedUser } } = req;
      if (priority) baseFilter["work_order.priority"] = { $in: priority.toString().split(',') };
      if (location_id) baseFilter["work_order.wo_location_id"] = { $in: helperService.validateObjectIds(String(location_id)) };
      if (assignedUser) baseFilter["work_order.userIdList"] = { $in: assignedUser.toString().split(",") };

      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        mapping: "location",
        idField: "work_order.wo_location_id",
        createdByField: "work_order.userIdList"
      });

      const data = await scheduleService.getSchedules(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Schedule not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Schedules fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async getDataById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const { params: { id } } = req;
      const baseFilter: any = { _id: helperService.validateObjectId(String(id)), account_id, visible: true };

      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        mapping: "location",
        idField: "work_order.wo_location_id",
        createdByField: "createdBy"
      });

      const data = await scheduleService.getSchedules(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error("Schedule not found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Schedule fetched successfully", data });
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
      res.status(201).json({ status: true, message: "Schedule created successfully", data });
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
        throw Object.assign(new Error('Schedule not found'), { status: 404 });
      }
      const data = await scheduleService.updateSchedules(id, body, user_id);
      res.status(200).json({ status: true, message: "Schedule updated successfully", data });
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
        throw Object.assign(new Error('Schedule not found'), { status: 404 });
      }
      const data = await scheduleService.removeSchedules(id, user_id);
      if (!data) {
        throw Object.assign(new Error('Schedule not deleted'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Schedule deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const scheduleController = new ScheduleController();