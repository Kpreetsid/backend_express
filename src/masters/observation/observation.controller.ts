import { Request, Response, NextFunction } from 'express';
import { observationService } from './observation.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { assetService } from '../asset/asset.service';
import { processorAPIService } from '../../api-processor';

class ObservationController {

  getObservations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const match: any = { accountId: account_id };
      const { query: { locationId, assetId, alarmId } } = req;
      if (locationId) {
        match['locationId'] = helperService.validateObjectId(String(locationId));
      }
      if (assetId) {
        const childAssetIds = await assetService.getAllChildAssetIDs(helperService.validateObjectId(String(assetId)));
        match['assetId'] = { $in: childAssetIds };
      }
      if (alarmId) {
        match['alarmId'] = Number(alarmId);
      }
      const data = await observationService.getAllObservation(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  getObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const match: any = { _id: helperService.validateObjectId(String(id)), accountId: account_id };
      if (userRole !== 'admin') {
        match['userId'] = user_id;
      }
      const data = await observationService.getAllObservation(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
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
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const match: any = { _id: data._id };
      const insertedData = await observationService.getAllObservation(match);
      if (!insertedData || insertedData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      await processorAPIService.updateAssetHealthStatus(body, account_id, user_id, userToken);
      res.status(201).json({ status: true, message: "Data created successfully", data: insertedData });
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
      const { params: { id }, body } = req;
      const existingData = await observationService.getAllObservation({ _id: helperService.validateObjectId(String(id)), accountId: account_id });
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const data = await observationService.updateObservationById(helperService.validateObjectId(String(id)), body, user_id);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const match: any = { _id: helperService.validateObjectId(String(id)) };
      const insertedData = await observationService.getAllObservation(match);
      if (!insertedData || insertedData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data updated successfully", data: insertedData });
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
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const data = await observationService.removeObservationById(helperService.validateObjectId(String(id)), user_id);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data updated successfully" });
    } catch (error) {
      next(error);
    }
  }
}
export const observationController = new ObservationController();