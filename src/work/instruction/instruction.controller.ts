import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { instructionService } from './instruction.service';
import { helperService } from '../../util/helper';

class InstructionController {
  async getAll (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const match: any = { account_id, visible: true };
      const data: any[] = await instructionService.getInstructions(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      return res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async getDataById (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const instructionId = helperService.validateObjectId(id);
      const match: any = { _id: instructionId, account_id: account_id, visible: true };
      const data = await instructionService.getInstructions(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async create (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const body = req.body;
      const data = await instructionService.createInstructions(body, account_id, user_id);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(201).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async update (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      const instructionId = helperService.validateObjectId(id);
      const match: any = { _id: instructionId, account_id: account_id, visible: true };
      const existingRequest = await instructionService.getInstructions(match);
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const data = await instructionService.updateInstructions(String(id), body, user_id);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).send({ status: true, message: 'Work order updated successfully', data: body });
    } catch (error) {
      next(error);
    }
  }
  
  async remove (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const instructionId = helperService.validateObjectId(id);
      const match: any = { _id: instructionId, account_id: account_id, visible: true };
      const existingRequest = await instructionService.getInstructions(match);
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      await instructionService.deleteInstructionsById(String(id), user_id);
      res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const instructionController = new InstructionController();