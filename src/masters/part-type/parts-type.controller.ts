import { NextFunction, Request, Response } from "express";
import { partsTypeService } from "./parts-type.service";
import { IUser } from "../../models/user.model";
import { get } from "lodash";
import { helperService } from "../../utils/helper";
import { applyRoleFilter } from "../../utils/roleFilter";

class PartsTypeController {

  getPartsTypes = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { query: { name } } = req;
      const baseFilter: any = { visible: true };
      if (name) {
        baseFilter.name = { $regex: name, $options: 'i' };
      }
      const filter = await applyRoleFilter({ user, baseFilter, accountField: "account_id" });
      const data = await partsTypeService.getPartTypes(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Part types not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Part types fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  getPartType = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const baseFilter: any = { _id: helperService.validateObjectId(String(id)), visible: true };
      const filter = await applyRoleFilter({ user, baseFilter, accountField: "account_id" });
      const data = await partsTypeService.getPartTypes(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Part type not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Part type fetched successfully", data: data[0] });
    } catch (error) {
      next(error);
    }
  }

  createPartType = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { body } = req;
      const data = await partsTypeService.createPartType({ ...body, account_id, createdBy: user_id });
      if (!data) {
        throw Object.assign(new Error('Failed to create part type'), { status: 400 });
      }
      const match: any = { _id: data._id };
      const insertedData = await partsTypeService.getPartTypes(match);
      res.status(201).json({ status: true, message: "Part type created successfully", data: insertedData[0] });
    } catch (error) {
      next(error);
    }
  }

  updatePartType = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      const existingData = await partsTypeService.getPartTypes({ _id: helperService.validateObjectId(String(id)), account_id, visible: true });
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('Part type not found'), { status: 404 });
      }
      const data = await partsTypeService.updatePartType(helperService.validateObjectId(String(id)), body, user_id);
      if (!data) {
        throw Object.assign(new Error('Failed to update part type'), { status: 400 });
      }
      const match: any = { _id: helperService.validateObjectId(String(id)) };
      const updatedData = await partsTypeService.getPartTypes(match);
      res.status(200).json({ status: true, message: "Part type updated successfully", data: updatedData[0] });
    } catch (error) {
      next(error);
    }
  }

  removePartType = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const existingData = await partsTypeService.getPartTypes({ _id: helperService.validateObjectId(String(id)), account_id, visible: true });
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('Part type not found'), { status: 404 });
      }
      const data = await partsTypeService.removePartType(helperService.validateObjectId(String(id)), user_id);
      if (!data) {
        throw Object.assign(new Error('Failed to delete part type'), { status: 400 });
      }
      res.status(200).json({ status: true, message: "Part type deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const partsTypeController = new PartsTypeController();