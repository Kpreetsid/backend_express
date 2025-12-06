import { Request, Response, NextFunction } from 'express';
import { get } from "lodash";
import { partsService } from './parts.service';
import { IUser } from '../../models/user.model';
import mongoose from 'mongoose';
import { mapUserToLocationService } from '../../transaction/mapUserLocation/userLocation.service';

class PartsController {

  async getParts(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const match: any = { account_id, visible: true };
      const { query: { id, location_id } } = req;
      if (id) {
        match._id = { $in: id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id)) };
      }
      if (location_id) {
        match.location_id = { $in: location_id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id)) };
      }
      if (userRole !== 'admin') {
        const mappedUserList = await mapUserToLocationService.getLocationsMappedData(user_id);
        match.location_id = { $in: mappedUserList.map((doc: any) => doc.locationId) };
      }
      const data = await partsService.getAllParts(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async getPart(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const match: any = { account_id, visible: true };
      const { params: { id } } = req;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      match._id = new mongoose.Types.ObjectId(id);
      if (userRole !== 'admin') {
        const mappedUserList = await mapUserToLocationService.getLocationsMappedData(user_id);
        match.location_id = { $in: mappedUserList.map((doc: any) => doc.locationId) };
      }
      const data = await partsService.getAllParts(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async createPart(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const data = await partsService.insert(req.body, account_id, user_id);
      res.status(201).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async updatePart(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      const match: any = { _id: new mongoose.Types.ObjectId(id), account_id, visible: true };
      const isDataExists = await partsService.getAllParts(match);
      if (!isDataExists || isDataExists.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const data = await partsService.updatePartById(id, body, user_id);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async updateStock(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body: { quantity, part_number } } = req;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      const part = await partsService.getAllParts({ _id: new mongoose.Types.ObjectId(id), account_id, visible: true });
      if (!part || part.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      if (part[0].part_number !== part_number) {
        throw Object.assign(new Error('Part number does not match'), { status: 400 });
      }
      part[0].quantity = Number(part[0].quantity) + Number(quantity);
      const updatedPart = await partsService.updatePartStock(id, part[0], user_id);
      if (!updatedPart) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data updated successfully", data: updatedPart });
    } catch (error) {
      next(error);
    }
  };

  async removePart(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      const match: any = { _id: new mongoose.Types.ObjectId(id), account_id, visible: true };
      const isDataExists = await partsService.getAllParts(match);
      if (!isDataExists || isDataExists.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const data = await partsService.removeById(id, user_id);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const partsController = new PartsController();