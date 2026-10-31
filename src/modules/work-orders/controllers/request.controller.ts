import { controllerCache } from '@core/cache/controller-cache.service';
import { Request, Response, NextFunction } from 'express';
import { requestService } from '@modules/work-orders/services/request.service';
import { get } from 'lodash';
import { IUser } from '@modules/users/models/user.model';
import { WORK_REQUEST_PRIORITIES, WORK_REQUEST_STATUSES } from '@modules/work-orders/models/workRequest.model';
import { helperService } from '@common/utils/helper';
import { applyRoleFilter } from '@common/utils/role-filter.helper';
import { notificationService } from '@modules/communications/services/notification-sender.service';
import { assertSyncVersion, getExpectedSyncVersion, setSyncVersionEtag } from '@common/utils/sync-concurrency.helper';

const editableRequestFields = ['title', 'description', 'problemType', 'priority', 'location_id', 'asset_id', 'files', 'status', 'tags', 'remarks', 'review_sla_hours', 'order_sla_hours'] as const;
function editableRequestPayload(value: any): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('A work request object is required'), { status: 400 });
  const payload: Record<string, any> = {};
  for (const field of editableRequestFields) if (Object.prototype.hasOwnProperty.call(value, field)) payload[field] = value[field];
  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    if (!WORK_REQUEST_STATUSES.includes(payload.status)) throw Object.assign(new Error('Status is not editable'), { status: 400 });
    if (['Approved', 'Rejected'].includes(payload.status)) throw Object.assign(new Error('Use the dedicated approval actions for this request'), { status: 400 });
  }
  return payload;
}

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
        baseFilter.approvedBy = { $in: helperService.validateObjectIds(approvedBy.toString()) };
      }
      if (rejectedBy) {
        baseFilter.rejectedBy = { $in: helperService.validateObjectIds(rejectedBy.toString()) };
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
      const { params: { id } } = req;
      const requestId = helperService.validateObjectId(id);
      const baseFilter: any = { _id: requestId, account_id: account_id, visible: true };

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
      setSyncVersionEtag(res, data[0]);
      res.status(200).json({ status: true, message: "Work request fetched successfully.", data: data[0] });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const body = editableRequestPayload(req.body);
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
      setSyncVersionEtag(res, data);
      res.status(200).json({ status: true, message: "Work request created successfully.", data });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, firstName, lastName } = get(req, "user", {}) as IUser;
      const { params: { id, status } } = req;
      const body = editableRequestPayload(req.body);
      const requestId = helperService.validateObjectId(id);
      if (status === 'Approved' || status === 'Rejected') {
        throw Object.assign(new Error('Use the dedicated approval actions for this request'), { status: 400 });
      }
      if (status) {
        if (!WORK_REQUEST_STATUSES.includes(String(status))) {
          throw Object.assign(new Error('Status is not editable'), { status: 400 });
        }
        body.status = status;
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
      const expectedVersion = getExpectedSyncVersion(req);
      assertSyncVersion(existingRequest[0], expectedVersion);
      if (typeof body.remarks !== 'string' || !body.remarks.trim() || body.remarks === existingRequest[0].remarks) {
        delete body.remarks;
      } else {
        body.remarks = body.remarks.trim();
        const dateTime = `${new Date().toISOString().split('T')[0]} ${new Date().toISOString().split('T')[1].split('.')[0]}`;
        body.remarks = existingRequest[0].remarks ? `${existingRequest[0].remarks} ${body.remarks} by ${firstName} ${lastName} on ${dateTime}` : `${body.remarks} by ${firstName} ${lastName} on ${dateTime}`;
      }
      if (status === existingRequest[0].status) {
        throw Object.assign(new Error('No changes detected'), { status: 400 });
      }
      if (existingRequest[0].converted_work_order_id) {
        throw Object.assign(new Error('Converted work requests cannot be edited'), { status: 400 });
      }
      if (['Approved', 'Rejected'].includes(existingRequest[0].status)) {
        throw Object.assign(new Error('Finalized work requests cannot be edited'), { status: 400 });
      }
      const data = await requestService.updateRequest(String(id), body, user_id, undefined, expectedVersion);
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
      const updatedRequest = await requestService.getRequestById(String(id));
      setSyncVersionEtag(res, updatedRequest);
      res.status(200).json({ status: true, message: "Work request updated successfully.", data: updatedRequest });
    } catch (error) {
      next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role } = get(req, "user", {}) as IUser;
      if (user_role !== 'admin') {
        throw Object.assign(new Error('Only administrators can approve work requests'), { status: 403 });
      }
      const { params: { id } } = req;
      const requestId = helperService.validateObjectId(id);
      const existingRequest = await requestService.getAllRequests({ _id: requestId, account_id });
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('Work request not found'), { status: 404 });
      }
      const expectedVersion = getExpectedSyncVersion(req);
      assertSyncVersion(existingRequest[0], expectedVersion);
      if (existingRequest[0].status === 'Approved') {
        throw Object.assign(new Error('Request is already approved'), { status: 400 });
      }
      if (existingRequest[0].status === 'Rejected') {
        throw Object.assign(new Error('Rejected requests cannot be approved'), { status: 400 });
      }
      if (existingRequest[0].converted_work_order_id) {
        throw Object.assign(new Error('This request has already been converted into a work order'), { status: 400 });
      }
      const data = await requestService.markApproved(String(id), user_id, existingRequest[0].priority, undefined, expectedVersion);
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
      const updatedRequest = await requestService.getRequestById(String(id));
      setSyncVersionEtag(res, updatedRequest);
      res.status(200).json({ status: true, message: "Work request approved successfully.", data: updatedRequest });
    } catch (error) {
      next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, firstName, lastName, user_role } = get(req, "user", {}) as IUser;
      if (user_role !== 'admin') {
        throw Object.assign(new Error('Only administrators can reject work requests'), { status: 403 });
      }
      const { params: { id } } = req;
      const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks.trim() : '';
      const requestId = helperService.validateObjectId(id);
      if (!remarks) {
        throw Object.assign(new Error('Remarks is required'), { status: 400 });
      }
      const existingRequest = await requestService.getAllRequests({ _id: requestId, account_id });
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('Work request not found'), { status: 404 });
      }
      const expectedVersion = getExpectedSyncVersion(req);
      assertSyncVersion(existingRequest[0], expectedVersion);
      if (existingRequest[0].status === 'Rejected') {
        throw Object.assign(new Error('Request is already rejected'), { status: 400 });
      }
      if (existingRequest[0].status === 'Approved') {
        throw Object.assign(new Error('Approved requests cannot be rejected'), { status: 400 });
      }
      if (existingRequest[0].converted_work_order_id) {
        throw Object.assign(new Error('Converted work requests cannot be rejected'), { status: 400 });
      }
      const dateTime = `${new Date().toISOString().split('T')[0]} ${new Date().toISOString().split('T')[1].split('.')[0]}`;
      const updatedRemarks = existingRequest[0].remarks ? `${existingRequest[0].remarks} ${remarks} by ${firstName} ${lastName} on ${dateTime}` : `${remarks} by ${firstName} ${lastName} on ${dateTime}`;
      const data = await requestService.markRejected(String(id), user_id, updatedRemarks, undefined, expectedVersion);
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
      const updatedRequest = await requestService.getRequestById(String(id));
      setSyncVersionEtag(res, updatedRequest);
      res.status(200).json({ status: true, message: "Work request rejected successfully.", data: updatedRequest });
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

export const requestController = controllerCache.withCache(new RequestController(), { namespace: 'work-requests', ttlSeconds: 120, tags: ['work-requests', 'work-orders'] });
