import { Request, Response, NextFunction } from 'express';
import { observationService } from './observation.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { assetService } from '../asset/asset.service';
import { processorAPIService } from '../../api-processor';
import { applyRoleFilter } from '../../utils/roleFilter';

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
      }
      await processorAPIService.updateAssetHealthStatus(body, account_id, user_id, userToken);
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
      }
      await processorAPIService.updateAssetHealthStatus(body, account_id, user_id, userToken);
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
export const observationController = new ObservationController();