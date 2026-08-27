<<<<<<< Updated upstream
import { controllerCache } from '../../_cache/controllerCache.service';
import { Request, Response, NextFunction } from 'express';
import { observationService } from './observation.service';
=======
import { Request, Response, NextFunction } from 'express';
>>>>>>> Stashed changes
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { assetService } from '../asset/asset.service';
import { processorAPIService } from '../../api-processor';
import { applyRoleFilter } from '../../utils/roleFilter';
import { notificationService } from '../../utils/notification.service';
<<<<<<< Updated upstream

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
    var data: any;
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const userToken = get(req, "userToken", {}) as string;
      const { body } = req;
      data = await observationService.insertObservation(body, account_id, user_id);
      if (!data) {
        throw Object.assign(new Error('Observation not found'), { status: 404 });
      }
      const match: any = { _id: data._id };
      const insertedData = await observationService.getAllObservation(match);
      if (!insertedData || insertedData.length === 0) {
        throw Object.assign(new Error('Observation not found'), { status: 404 });
=======
import { observationService } from './observation.service';
import {
  OBSERVATION_LIMITS,
  sanitizeObservationCreatePayload,
  sanitizeObservationUpdatePayload
} from './observation.policy';

class ObservationController {
  getObservations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const baseFilter: any = { visible: true };
      const { locationId, assetId, alarmId } = req.query;
      if (locationId) {
        baseFilter.locationId = helperService.validateObjectId(String(locationId));
>>>>>>> Stashed changes
      }
      if (assetId) {
        const validatedAssetId = helperService.validateObjectId(String(assetId));
        const childAssetIds = await assetService.getAllChildAssetIDs(validatedAssetId);
        baseFilter.assetId = { $in: childAssetIds };
      }
      if (alarmId !== undefined) {
        baseFilter.alarmId = parseAlarmId(alarmId);
      }
      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: 'accountId',
        mapping: 'asset',
        idField: 'assetId'
      });
      const data = await observationService.getAllObservation(filter);
      res.status(200).json({ status: true, message: 'Observations fetched successfully', data });
    } catch (error) {
      next(error);
    }
  };

  getObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, 'user', {}) as IUser;
      const id = helperService.validateObjectId(String(req.params.id));
      const filter = await applyRoleFilter({
        user,
        baseFilter: { _id: id, visible: true },
        accountField: 'accountId',
        mapping: 'asset',
        idField: 'assetId',
        createdByField: 'userId'
      });
      const data = await observationService.getAllObservation(filter);
      if (!data.length) throw notFound();
      res.status(200).json({ status: true, message: 'Observation fetched successfully', data });
    } catch (error) {
      next(error);
    }
  };

  createObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    let created: any;
    try {
      const { account_id: accountId, _id: userId } = get(req, 'user', {}) as IUser;
      const userToken = get(req, 'userToken', {}) as string;
      const payload = sanitizeObservationCreatePayload(req.body, accountId);
      await observationService.assertObservationReferences(payload, accountId);

      created = await observationService.insertObservation(payload, accountId, userId);
      const insertedData = await observationService.getAllObservation({
        _id: created._id,
        accountId,
        visible: true
      });
      if (!insertedData.length) throw notFound();

      await processorAPIService.updateAssetHealthStatus(payload, accountId, userId, userToken);
      await notificationService.notifyAccountUsers({
        accountId: String(accountId),
        module: 'Observation',
        event: 'created',
        entityId: String(created._id),
        entityName: 'Observation',
        actionUrl: `/assets/asset-timeline/${payload.assetId}`,
        queryParams: { observationId: String(created._id) },
        sourceUserId: String(userId)
      });
<<<<<<< Updated upstream
      res.status(201).json({ status: true, message: "Observation created successfully", data: insertedData });
    } catch (error) {
      if (data) {
        await observationService.deleteObservationById(data._id);
      }
      next(error);
    }
  }

  updateObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const userToken = get(req, "userToken", {}) as string;
      const { params: { id }, body } = req;
      const existingData = await observationService.getAllObservation({ _id: helperService.validateObjectId(String(id)), accountId: account_id });
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('Observation not found'), { status: 404 });
      }
      const data = await observationService.updateObservationById(helperService.validateObjectId(String(id)), body, user_id);
      if (!data) {
        throw Object.assign(new Error('Observation not found'), { status: 404 });
      }
      const match: any = { _id: helperService.validateObjectId(String(id)) };
      const insertedData = await observationService.getAllObservation(match);
      if (!insertedData || insertedData.length === 0) {
        throw Object.assign(new Error('Observation not found'), { status: 404 });
=======
      res.status(201).json({ status: true, message: 'Observation created successfully', data: insertedData });
    } catch (error) {
      if (created) {
        await observationService.deleteObservationById(created._id, created.accountId).catch(() => undefined);
>>>>>>> Stashed changes
      }
      next(error);
    }
  };

  updateObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id: accountId, _id: userId } = get(req, 'user', {}) as IUser;
      const userToken = get(req, 'userToken', {}) as string;
      const id = helperService.validateObjectId(String(req.params.id));
      const existing = await observationService.getObservationRecord(id, accountId);
      if (!existing) throw notFound();
      assertStandaloneObservation(existing);

      const payload = sanitizeObservationUpdatePayload(req.body, existing.files, accountId);
      const updated = await observationService.updateObservationById(id, payload, accountId, userId);
      if (!updated) throw conflict('Observation is no longer editable');
      const updatedData = await observationService.getAllObservation({
        _id: id,
        accountId,
        visible: true
      });
      if (!updatedData.length) throw notFound();

      await processorAPIService.updateAssetHealthStatus({
        assetId: existing.assetId,
        alarmId: existing.alarmId,
        status: payload.status
      }, accountId, userId, userToken);
      await notificationService.notifyAccountUsers({
        accountId: String(accountId),
        module: 'Observation',
        event: 'updated',
        entityId: String(id),
        entityName: 'Observation',
        actionUrl: `/assets/asset-timeline/${existing.assetId}`,
        queryParams: { observationId: String(id) },
        sourceUserId: String(userId)
      });
<<<<<<< Updated upstream
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
      const data = await observationService.removeObservationById(helperService.validateObjectId(String(id)), user_id);
      if (!data) {
        throw Object.assign(new Error('Observation not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Observation deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}
export const observationController = controllerCache.withCache(new ObservationController(), { namespace: 'observations', ttlSeconds: 300, tags: ['observations', 'assets', 'locations'] });
=======
      res.status(200).json({ status: true, message: 'Observation updated successfully', data: updatedData });
    } catch (error) {
      next(error);
    }
  };

  removeObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id: accountId, _id: userId } = get(req, 'user', {}) as IUser;
      const id = helperService.validateObjectId(String(req.params.id));
      const existing = await observationService.getObservationRecord(id, accountId);
      if (!existing) throw notFound();
      assertStandaloneObservation(existing);

      const removed = await observationService.removeObservationById(id, accountId, userId);
      if (!removed) throw conflict('Observation is no longer editable');
      res.status(200).json({ status: true, message: 'Observation deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}

function parseAlarmId(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(String(value));
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > OBSERVATION_LIMITS.alarmId) {
    throw Object.assign(new Error('Invalid alarm ID'), { status: 400 });
  }
  return parsed;
}

function assertStandaloneObservation(observation: any): void {
  if (observation.report_id !== undefined && observation.report_id !== null) {
    throw conflict('Report observations cannot be edited or deleted from the timeline');
  }
  if (observation.alarmId !== undefined && observation.alarmId !== null) {
    throw conflict('Alarm observations cannot be edited or deleted from the timeline');
  }
}

function notFound(): Error {
  return Object.assign(new Error('Observation not found'), { status: 404 });
}

function conflict(message: string): Error {
  return Object.assign(new Error(message), { status: 409 });
}

export const observationController = new ObservationController();
>>>>>>> Stashed changes
