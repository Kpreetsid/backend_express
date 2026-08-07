import { Request, Response, NextFunction } from 'express';
import { observationService } from './observation.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { assetService } from '../asset/asset.service';
import { applyRoleFilter } from '../../utils/roleFilter';
import { notificationService } from '../../utils/notification.service';
import { withTransaction } from '../../utils/transaction.helper';
import {
  queueObservationAssetHealthSync
} from '../../queue/processor-events';
import {
  synchronizeObservationAssetHealth
} from '../../queue/handlers/observation-asset-health.handler';
import { randomUUID } from 'node:crypto';

const sanitizeObservationBody = (body: Record<string, unknown>): Record<string, unknown> => {
  const sanitized = { ...body };
  for (const field of ['_id', 'accountId', 'userId', 'createdBy', 'updatedBy', 'visible']) {
    delete sanitized[field];
  }
  return sanitized;
};

class ObservationController {

  getObservations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const baseFilter: any = {};
      const { query: { locationId, assetId, alarmId } } = req;
      if (locationId) {
        baseFilter['locationId'] = helperService.validateObjectId(String(locationId));
      }
      if (assetId) {
        const childAssetIds = await assetService.getAllChildAssetIDs(helperService.validateObjectId(String(assetId)));
        baseFilter['assetId'] = { $in: childAssetIds };
      }
      if (alarmId) {
        baseFilter['alarmId'] = Number(alarmId);
      }
      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "accountId",
        mapping: "asset",
        idField: "assetId"
      });
      const data = await observationService.getAllObservation(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Observation not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Observations fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  getObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const baseFilter: any = { _id: helperService.validateObjectId(String(id)) };
      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "accountId",
        mapping: "asset",
        idField: "assetId",
        createdByField: "userId"
      });
      const data = await observationService.getAllObservation(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Observation not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Observation fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  createObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const body = sanitizeObservationBody(req.body);
      const correlationId = String(res.locals['correlationId'] || randomUUID());
      const result = await withTransaction(async (session) => {
        await observationService.requireTenantReferences(body, account_id, session);
        const created = await observationService.insertObservation(
          body,
          account_id,
          user_id,
          session
        );
        const processorQueued = await queueObservationAssetHealthSync({
          observationId: String(created._id),
          tenantId: String(account_id),
          actorId: String(user_id),
          correlationId
        }, session);
        await notificationService.queueAccountNotification({
          accountId: String(account_id),
          module: 'Observation',
          event: 'created',
          entityId: String(created._id),
          entityName: 'Observation',
          actionUrl: `/assets/asset-timeline/${created.assetId}`,
          queryParams: { observationId: String(created._id) },
          sourceUserId: String(user_id)
        }, { session, correlationId });
        return { created, processorQueued };
      });
      if (!result.processorQueued) {
        await synchronizeObservationAssetHealth(
          String(result.created._id),
          String(account_id),
          String(user_id)
        );
      }
      const match: any = { _id: result.created._id, accountId: account_id };
      const insertedData = await observationService.getAllObservation(match);
      if (!insertedData || insertedData.length === 0) {
        throw Object.assign(new Error('Observation not found'), { status: 404 });
      }
      res.status(201).json({ status: true, message: "Observation created successfully", data: insertedData });
    } catch (error) {
      next(error);
    }
  }

  updateObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      const observationId = helperService.validateObjectId(String(id));
      const existingData = await observationService.getAllObservation({ _id: observationId, accountId: account_id });
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('Observation not found'), { status: 404 });
      }
      const sanitizedBody = sanitizeObservationBody(body);
      const correlationId = String(res.locals['correlationId'] || randomUUID());
      const result = await withTransaction(async (session) => {
        await observationService.requireTenantReferences(sanitizedBody, account_id, session);
        const updated = await observationService.updateObservationById(
          observationId,
          sanitizedBody,
          account_id,
          user_id,
          session
        );
        if (!updated) {
          throw Object.assign(new Error('Observation not found'), { status: 404 });
        }
        const processorQueued = await queueObservationAssetHealthSync({
          observationId: String(id),
          tenantId: String(account_id),
          actorId: String(user_id),
          correlationId
        }, session);
        await notificationService.queueAccountNotification({
          accountId: String(account_id),
          module: 'Observation',
          event: 'updated',
          entityId: String(id),
          entityName: 'Observation',
          actionUrl: `/assets/asset-timeline/${updated.assetId}`,
          queryParams: { observationId: String(id) },
          sourceUserId: String(user_id)
        }, { session, correlationId });
        return { processorQueued };
      });
      if (!result.processorQueued) {
        await synchronizeObservationAssetHealth(
          String(id),
          String(account_id),
          String(user_id)
        );
      }
      const match: any = { _id: observationId, accountId: account_id };
      const insertedData = await observationService.getAllObservation(match);
      if (!insertedData || insertedData.length === 0) {
        throw Object.assign(new Error('Observation not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Observation updated successfully", data: insertedData });
    } catch (error) {
      next(error);
    }
  }

  removeObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const existingData = await observationService.getAllObservation({ _id: helperService.validateObjectId(String(id)), accountId: account_id });
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('Observation not found'), { status: 404 });
      }
      const data = await observationService.removeObservationById(
        helperService.validateObjectId(String(id)),
        account_id,
        user_id
      );
      if (!data) {
        throw Object.assign(new Error('Observation not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Observation deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}
export const observationController = new ObservationController();
