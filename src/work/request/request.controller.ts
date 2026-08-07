import { Request, Response, NextFunction } from 'express';
import { requestService } from './request.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { WORK_REQUEST_PRIORITIES, WORK_REQUEST_STATUSES } from '../../models/workRequest.model';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';
import { notificationService } from '../../utils/notification.service';
import { assertSyncVersion, getExpectedSyncVersion, setSyncVersionEtag } from '../../utils/sync-concurrency';
import { withTransaction } from '../../utils/transaction.helper';
import { ClientSession } from 'mongoose';

const queueWorkRequestNotification = async (
  payload: Parameters<typeof notificationService.queueAccountNotification>[0],
  session: ClientSession,
  correlationId: string
): Promise<void> => {
  await notificationService.queueAccountNotification(payload, { session, correlationId });
};

class RequestController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const {
        query: {
          priority,
          location,
          asset,
          status,
          assignedTo,
          assignedBy,
          approvedBy,
          rejectedBy
        }
      } = req;
      const baseFilter: any = { account_id: account_id, visible: true };
      if (priority) {
        baseFilter.priority = priority.toString().split(",").map((p) => p.trim()).filter((p) => p !== "");
      }
      if (location) {
        baseFilter.location_id = { $in: helperService.validateObjectIds(location.toString()) };
      }
      if (asset) {
        baseFilter.asset_id = { $in: helperService.validateObjectIds(asset.toString()) };
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

      const data = await requestService.getAllRequests(account_id, filter);
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
        const {
          _id: _ignoredId,
          account_id: _ignoredAccountId,
          visible: _ignoredVisibility,
          ...safeQuery
        } = query;
        baseFilter = { ...safeQuery, ...baseFilter };
      }

      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        mapping: "location",
        idField: "location_id"
      });

      const data = await requestService.getAllRequests(account_id, filter);
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
      const body = req.body;
      const correlationId = String(res.locals['correlationId'] || '');
      const data = await withTransaction(async (session) => {
        const createdRequest = await requestService.createRequest(body, user, session);
        if (!createdRequest) {
          throw Object.assign(new Error('Work request not created'), { status: 404 });
        }
        await queueWorkRequestNotification({
          accountId: String(user.account_id),
          module: 'Work Request',
          event: 'created',
          entityId: String(createdRequest._id),
          entityName: createdRequest.title || createdRequest.problemType || 'Work Request',
          actionUrl: '/work-request',
          queryParams: { id: String(createdRequest._id) },
          sourceUserId: String(user._id)
        }, session, correlationId);
        return createdRequest;
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
      const { params: { id, status }, body } = req;
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
      const existingRequest = await requestService.getAllRequests(account_id, { _id: requestId });
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('Work request not found'), { status: 404 });
      }
      const currentRequest = existingRequest[0]!;
      const expectedVersion = getExpectedSyncVersion(req);
      assertSyncVersion(currentRequest, expectedVersion);
      if (
        Object.prototype.hasOwnProperty.call(body, 'remarks')
        && body.remarks !== currentRequest.remarks
      ) {
        const dateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        body.remarks = currentRequest.remarks ? `${currentRequest.remarks} ${body.remarks} by ${firstName} ${lastName} on ${dateTime}` : `${body.remarks} by ${firstName} ${lastName} on ${dateTime}`;
      }
      if (status === currentRequest.status) {
        throw Object.assign(new Error('No changes detected'), { status: 400 });
      }
      if (currentRequest.converted_work_order_id) {
        throw Object.assign(new Error('Converted work requests cannot be edited'), { status: 400 });
      }
      if (['Approved', 'Rejected'].includes(currentRequest.status)) {
        throw Object.assign(new Error('Finalized work requests cannot be edited'), { status: 400 });
      }
      const correlationId = String(res.locals['correlationId'] || '');
      await withTransaction(async (session) => {
        const data = await requestService.updateRequest(
          String(id),
          account_id,
          body,
          user_id,
          session,
          expectedVersion
        );
        if (!data || data.modifiedCount === 0) {
          throw Object.assign(new Error('Work request not updated'), { status: 404 });
        }
        await queueWorkRequestNotification({
          accountId: String(account_id),
          module: 'Work Request',
          event: 'updated',
          entityId: String(id),
          entityName: body.title || currentRequest.title || currentRequest.problemType || 'Work Request',
          actionUrl: '/work-request',
          queryParams: { id: String(id) },
          sourceUserId: String(user_id)
        }, session, correlationId);
      });
      const updatedRequest = await requestService.getRequestById(String(id), account_id);
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
      const existingRequest = await requestService.getAllRequests(account_id, { _id: requestId });
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('Work request not found'), { status: 404 });
      }
      const currentRequest = existingRequest[0]!;
      const expectedVersion = getExpectedSyncVersion(req);
      assertSyncVersion(currentRequest, expectedVersion);
      if (currentRequest.status === 'Approved') {
        throw Object.assign(new Error('Request is already approved'), { status: 400 });
      }
      if (currentRequest.status === 'Rejected') {
        throw Object.assign(new Error('Rejected requests cannot be approved'), { status: 400 });
      }
      if (currentRequest.converted_work_order_id) {
        throw Object.assign(new Error('This request has already been converted into a work order'), { status: 400 });
      }
      const correlationId = String(res.locals['correlationId'] || '');
      await withTransaction(async (session) => {
        const data = await requestService.markApproved(
          String(id),
          account_id,
          user_id,
          currentRequest.priority,
          session,
          expectedVersion
        );
        if (!data || data.modifiedCount === 0) {
          throw Object.assign(new Error('Work request not updated'), { status: 404 });
        }
        await queueWorkRequestNotification({
          accountId: String(account_id),
          module: 'Work Request',
          event: 'updated',
          entityId: String(id),
          entityName: currentRequest.title || currentRequest.problemType || 'Work Request',
          actionUrl: '/work-request',
          queryParams: { id: String(id) },
          sourceUserId: String(user_id)
        }, session, correlationId);
      });
      const updatedRequest = await requestService.getRequestById(String(id), account_id);
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
      const { params: { id }, body: { remarks } } = req;
      const requestId = helperService.validateObjectId(id);
      if (!remarks) {
        throw Object.assign(new Error('Remarks is required'), { status: 400 });
      }
      const existingRequest = await requestService.getAllRequests(account_id, { _id: requestId });
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('Work request not found'), { status: 404 });
      }
      const currentRequest = existingRequest[0]!;
      const expectedVersion = getExpectedSyncVersion(req);
      assertSyncVersion(currentRequest, expectedVersion);
      if (currentRequest.status === 'Rejected') {
        throw Object.assign(new Error('Request is already rejected'), { status: 400 });
      }
      if (currentRequest.status === 'Approved') {
        throw Object.assign(new Error('Approved requests cannot be rejected'), { status: 400 });
      }
      if (currentRequest.converted_work_order_id) {
        throw Object.assign(new Error('Converted work requests cannot be rejected'), { status: 400 });
      }
      const dateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const updatedRemarks = currentRequest.remarks ? `${currentRequest.remarks} ${remarks} by ${firstName} ${lastName} on ${dateTime}` : `${remarks} by ${firstName} ${lastName} on ${dateTime}`;
      const correlationId = String(res.locals['correlationId'] || '');
      await withTransaction(async (session) => {
        const data = await requestService.markRejected(
          String(id),
          account_id,
          user_id,
          updatedRemarks,
          session,
          expectedVersion
        );
        if (!data || data.modifiedCount === 0) {
          throw Object.assign(new Error('Work request not updated'), { status: 404 });
        }
        await queueWorkRequestNotification({
          accountId: String(account_id),
          module: 'Work Request',
          event: 'updated',
          entityId: String(id),
          entityName: currentRequest.title || currentRequest.problemType || 'Work Request',
          actionUrl: '/work-request',
          queryParams: { id: String(id) },
          sourceUserId: String(user_id)
        }, session, correlationId);
      });
      const updatedRequest = await requestService.getRequestById(String(id), account_id);
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
      const existingRequest = await requestService.getAllRequests(account_id, match);
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('Work request not found'), { status: 404 });
      }
      await requestService.deleteRequestById(id, account_id, user_id);
      res.status(200).json({ status: true, message: "Work request deleted successfully." });
    } catch (error) {
      next(error);
    }
  }
}

export const requestController = new RequestController();
