import { Request, Response, NextFunction } from 'express';
import { requestService } from './request.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { WORK_REQUEST_PRIORITIES, WORK_REQUEST_STATUSES } from '../../models/workRequest.model';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';
import { notificationService } from '../../utils/notification.service';

class RequestController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const { query: { priority, location, status, assignedTo, assignedBy, approvedBy, rejectedBy } } = req;
      const baseFilter: any = { account_id: account_id, visible: true };
      if (priority) {
        baseFilter.priority = priority.toString().split(",").map((p) => p.trim()).filter((p) => p !== "");
      }
      if (location) {
        baseFilter.location_id = { $in: helperService.validateObjectIds(location.toString()) };
      }
      if (status) {
        baseFilter.status = status.toString().split(",").map((s) => s.trim()).filter((s) => s !== "");
      }
      if (assignedTo) {
        baseFilter.assigned_to = { $in: helperService.validateObjectIds(assignedTo.toString()) };
      }
      if (assignedBy) {
        baseFilter.createdBy = { $in: helperService.validateObjectIds(assignedBy.toString()) };
      }
      if (approvedBy) {
        baseFilter.updatedBy = { $in: helperService.validateObjectIds(approvedBy.toString()) };
      }
      if (rejectedBy) {
        baseFilter.updatedBy = { $in: helperService.validateObjectIds(rejectedBy.toString()) };
      }

      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        mapping: "location",
        idField: "location_id"
      });

      const data = await requestService.getAllRequests(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Work request not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Work requests fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const { params: { id }, query } = req;
      const requestId = helperService.validateObjectId(id);
      let baseFilter: any = { _id: requestId, account_id: account_id, visible: true };
      if (query) {
        baseFilter = { ...baseFilter, ...query };
      }

      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        mapping: "location",
        idField: "location_id"
      });

      const data = await requestService.getAllRequests(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Work request not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Work request fetched successfully.", data: data[0] });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const body = req.body;
      const data = await requestService.createRequest(body, user);
      if (!data) {
        throw Object.assign(new Error('Work request not created'), { status: 404 });
      }
      await notificationService.notifyAccountUsers({
        accountId: String(user.account_id),
        module: 'Work Request',
        event: 'created',
        entityId: String(data._id),
        entityName: data.title || data.problemType || 'Work Request',
        actionUrl: '/work-request',
        queryParams: { id: String(data._id) },
        sourceUserId: String(user._id)
      });
      res.status(200).json({ status: true, message: "Work request created successfully.", data });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, firstName, lastName } = get(req, "user", {}) as IUser;
      const { params: { id, status }, body } = req;
      const requestId = helperService.validateObjectId(id);
      if (status) {
        if (!WORK_REQUEST_STATUSES.includes(String(status))) {
          throw Object.assign(new Error('Status is not editable'), { status: 400 });
        }
        body.status = status;
        if (status === 'Approved' || status === 'Rejected') {
          throw Object.assign(new Error('Create a valid request'), { status: 400 });
        }
      }
      if (body.priority) {
        if (!WORK_REQUEST_PRIORITIES.includes(body.priority)) {
          throw Object.assign(new Error('Invalid priority value'), { status: 400 });
        }
      }
      const existingRequest = await requestService.getAllRequests({ _id: requestId, account_id });
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('Work request not found'), { status: 404 });
      }
      if (body.remarks !== existingRequest[0].remarks) {
        const dateTime = `${new Date().toISOString().split('T')[0]} ${new Date().toISOString().split('T')[1].split('.')[0]}`;
        body.remarks = existingRequest[0].remarks ? `${existingRequest[0].remarks} ${body.remarks} by ${firstName} ${lastName} on ${dateTime}` : `${body.remarks} by ${firstName} ${lastName} on ${dateTime}`;
      }
      if (status === existingRequest[0].status) {
        throw Object.assign(new Error('No changes detected'), { status: 400 });
      }
      if (status === 'Approved') {
        body.approvedBy = user_id;
      }
      const data = await requestService.updateRequest(String(id), body, user_id);
      if (!data || data.modifiedCount === 0) {
        throw Object.assign(new Error('Work request not updated'), { status: 404 });
      }
      await notificationService.notifyAccountUsers({
        accountId: String(account_id),
        module: 'Work Request',
        event: 'updated',
        entityId: String(id),
        entityName: body.title || existingRequest[0].title || existingRequest[0].problemType || 'Work Request',
        actionUrl: '/work-request',
        queryParams: { id: String(id) },
        sourceUserId: String(user_id)
      });
      res.status(200).json({ status: true, message: "Work request updated successfully." });
    } catch (error) {
      next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const requestId = helperService.validateObjectId(id);
      const existingRequest = await requestService.getAllRequests({ _id: requestId, account_id });
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('Work request not found'), { status: 404 });
      }
      if (existingRequest[0].status === 'Approved') {
        throw Object.assign(new Error('Request is already approved'), { status: 400 });
      }
      const data = await requestService.updateRequest(String(id), { status: 'Approved', updatedBy: user_id }, user_id);
      if (!data || data.modifiedCount === 0) {
        throw Object.assign(new Error('Work request not updated'), { status: 404 });
      }
      await notificationService.notifyAccountUsers({
        accountId: String(account_id),
        module: 'Work Request',
        event: 'updated',
        entityId: String(id),
        entityName: existingRequest[0].title || existingRequest[0].problemType || 'Work Request',
        actionUrl: '/work-request',
        queryParams: { id: String(id) },
        sourceUserId: String(user_id)
      });
      res.status(200).json({ status: true, message: "Work request approved successfully." });
    } catch (error) {
      next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, firstName, lastName } = get(req, "user", {}) as IUser;
      const { params: { id }, body: { remarks } } = req;
      const requestId = helperService.validateObjectId(id);
      if (!remarks) {
        throw Object.assign(new Error('Remarks is required'), { status: 400 });
      }
      const existingRequest = await requestService.getAllRequests({ _id: requestId, account_id });
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('Work request not found'), { status: 404 });
      }
      if (existingRequest[0].status === 'Rejected') {
        throw Object.assign(new Error('Request is already rejected'), { status: 400 });
      }
      const dateTime = `${new Date().toISOString().split('T')[0]} ${new Date().toISOString().split('T')[1].split('.')[0]}`;
      const updatedRemarks = existingRequest[0].remarks ? `${existingRequest[0].remarks} ${remarks} by ${firstName} ${lastName} on ${dateTime}` : `${remarks} by ${firstName} ${lastName} on ${dateTime}`;
      const data = await requestService.updateRequest(String(id), { status: 'Rejected', remarks: updatedRemarks }, user_id);
      if (!data || data.modifiedCount === 0) {
        throw Object.assign(new Error('Work request not updated'), { status: 404 });
      }
      await notificationService.notifyAccountUsers({
        accountId: String(account_id),
        module: 'Work Request',
        event: 'updated',
        entityId: String(id),
        entityName: existingRequest[0].title || existingRequest[0].problemType || 'Work Request',
        actionUrl: '/work-request',
        queryParams: { id: String(id) },
        sourceUserId: String(user_id)
      });
      res.status(200).json({ status: true, message: "Work request rejected successfully." });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const requestId = helperService.validateObjectId(id);
      const match: any = { _id: requestId, account_id: account_id };
      const existingRequest = await requestService.getAllRequests(match);
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('Work request not found'), { status: 404 });
      }
      await requestService.deleteRequestById(id, user_id);
      res.status(200).json({ status: true, message: "Work request deleted successfully." });
    } catch (error) {
      next(error);
    }
  }
}

export const requestController = new RequestController();
