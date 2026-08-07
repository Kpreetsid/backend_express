import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { instructionService } from './instruction.service';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';
import { requireTenantReferences } from '../../utils/tenant-references';

class InstructionController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { assetId, locationId } = req.query;
      const baseFilter: any = {};
      if (assetId) {
        baseFilter.assetId = helperService.validateObjectId(String(assetId));
      }
      if (locationId) {
        baseFilter.locationId = helperService.validateObjectId(String(locationId));
      }
      const mapping = assetId ? 'asset' : locationId ? 'location' : '';
      const idField = assetId ? 'assetId' : locationId ? 'locationId' : '_id';
      const match = await applyRoleFilter({
        user,
        baseFilter,
        mapping,
        idField
      });
      const data: any[] = await instructionService.getInstructions(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Instruction not found'), { status: 404 });
      }
      return res.status(200).json({ status: true, message: "Instructions fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  }

  async getDataById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const instructionId = helperService.validateObjectId(id);
      const match = await applyRoleFilter({
        user,
        baseFilter: { _id: instructionId }
      });
      const data = await instructionService.getInstructions(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Instruction not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Instruction fetched successfully.", data });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const body = req.body;
      await requireTenantReferences(body, account_id);
      const data = await instructionService.createInstructions(body, account_id, user_id);
      if (!data) {
        throw Object.assign(new Error('Instruction not created'), { status: 404 });
      }
      res.status(201).json({ status: true, message: "Instruction created successfully.", data });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      const instructionId = helperService.validateObjectId(id);
      const match: any = { _id: instructionId, account_id: account_id, visible: true };
      const existingRequest = await instructionService.getInstructions(match);
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('Instruction not found'), { status: 404 });
      }
      await requireTenantReferences(body, account_id);
      const data = await instructionService.updateInstructions(String(id), body, account_id, user_id);
      if (!data) {
        throw Object.assign(new Error('Instruction not updated'), { status: 404 });
      }
      res.status(200).send({ status: true, message: 'Instruction updated successfully.', data: body });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const instructionId = helperService.validateObjectId(id);
      const match: any = { _id: instructionId, account_id: account_id, visible: true };
      const existingRequest = await instructionService.getInstructions(match);
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('Instruction not found'), { status: 404 });
      }
      await instructionService.deleteInstructionsById(String(id), account_id, user_id);
      res.status(200).json({ status: true, message: "Instruction deleted successfully." });
    } catch (error) {
      next(error);
    }
  }
}

export const instructionController = new InstructionController();
