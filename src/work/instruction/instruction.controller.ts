<<<<<<< Updated upstream
import { controllerCache } from '../../_cache/controllerCache.service';
=======
>>>>>>> Stashed changes
import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { instructionService } from './instruction.service';
import { helperService } from '../../utils/helper';
<<<<<<< Updated upstream
=======
import { sanitizeInstructionPayload } from '../../utils/guidePayload';
import {
  assertGuideMutationPermission,
  assertGuideTargetAccessible,
  assertSameGuideContext
} from '../../utils/guideScope';
>>>>>>> Stashed changes

class InstructionController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
<<<<<<< Updated upstream
      const { account_id } = get(req, "user", {}) as IUser;
      const match: any = { account_id, visible: true };
      const data: any[] = await instructionService.getInstructions(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Instruction not found'), { status: 404 });
      }
      return res.status(200).json({ status: true, message: "Instructions fetched successfully.", data });
=======
      const user = get(req, 'user', {}) as IUser;
      const context = await assertGuideTargetAccessible(user, req.query);
      const data = await instructionService.getInstructions({
        account_id: user.account_id,
        [context.field]: context.id
      });
      return res.status(200).json({ status: true, message: 'Instructions fetched successfully.', data });
>>>>>>> Stashed changes
    } catch (error) {
      next(error);
    }
  }

  async getDataById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
<<<<<<< Updated upstream
      const { account_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const instructionId = helperService.validateObjectId(id);
      const match: any = { _id: instructionId, account_id: account_id, visible: true };
      const data = await instructionService.getInstructions(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Instruction not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Instruction fetched successfully.", data });
=======
      const user = get(req, 'user', {}) as IUser;
      const instructionId = helperService.validateObjectId(req.params.id);
      const data = await instructionService.getInstructions({ _id: instructionId, account_id: user.account_id });
      if (!data.length) {
        throw Object.assign(new Error('Instruction not found'), { status: 404 });
      }
      await assertGuideTargetAccessible(user, data[0]);
      return res.status(200).json({ status: true, message: 'Instruction fetched successfully.', data });
>>>>>>> Stashed changes
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
<<<<<<< Updated upstream
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const body = req.body;
      const data = await instructionService.createInstructions(body, account_id, user_id);
      if (!data) {
        throw Object.assign(new Error('Instruction not created'), { status: 404 });
      }
      res.status(201).json({ status: true, message: "Instruction created successfully.", data });
=======
      const user = get(req, 'user', {}) as IUser;
      assertGuideMutationPermission(req, req.body);
      const payload = sanitizeInstructionPayload(req.body);
      await assertGuideTargetAccessible(user, payload);
      const data = await instructionService.createInstructions(payload, user.account_id, user._id);
      return res.status(201).json({ status: true, message: 'Instruction created successfully.', data });
>>>>>>> Stashed changes
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
<<<<<<< Updated upstream
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      const instructionId = helperService.validateObjectId(id);
      const match: any = { _id: instructionId, account_id: account_id, visible: true };
      const existingRequest = await instructionService.getInstructions(match);
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('Instruction not found'), { status: 404 });
      }
      const data = await instructionService.updateInstructions(String(id), body, user_id);
      if (!data) {
        throw Object.assign(new Error('Instruction not updated'), { status: 404 });
      }
      res.status(200).send({ status: true, message: 'Instruction updated successfully.', data: body });
=======
      const user = get(req, 'user', {}) as IUser;
      const instructionId = helperService.validateObjectId(req.params.id);
      const existing = await instructionService.getInstructions({ _id: instructionId, account_id: user.account_id });
      if (!existing.length) {
        throw Object.assign(new Error('Instruction not found'), { status: 404 });
      }
      assertGuideMutationPermission(req, existing[0]);
      await assertGuideTargetAccessible(user, existing[0]);
      const payload = sanitizeInstructionPayload(req.body);
      assertSameGuideContext(existing[0], payload);
      const data = await instructionService.updateInstructions(
        { _id: instructionId, account_id: user.account_id },
        payload,
        user._id
      );
      if (!data) {
        throw Object.assign(new Error('Instruction not found'), { status: 404 });
      }
      return res.status(200).json({ status: true, message: 'Instruction updated successfully.', data });
>>>>>>> Stashed changes
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
<<<<<<< Updated upstream
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const instructionId = helperService.validateObjectId(id);
      const match: any = { _id: instructionId, account_id: account_id, visible: true };
      const existingRequest = await instructionService.getInstructions(match);
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('Instruction not found'), { status: 404 });
      }
      await instructionService.deleteInstructionsById(String(id), user_id);
      res.status(200).json({ status: true, message: "Instruction deleted successfully." });
=======
      const user = get(req, 'user', {}) as IUser;
      const instructionId = helperService.validateObjectId(req.params.id);
      const existing = await instructionService.getInstructions({ _id: instructionId, account_id: user.account_id });
      if (!existing.length) {
        throw Object.assign(new Error('Instruction not found'), { status: 404 });
      }
      assertGuideMutationPermission(req, existing[0]);
      await assertGuideTargetAccessible(user, existing[0]);
      const data = await instructionService.deleteInstructions(
        { _id: instructionId, account_id: user.account_id },
        user._id
      );
      if (!data) {
        throw Object.assign(new Error('Instruction not found'), { status: 404 });
      }
      return res.status(200).json({ status: true, message: 'Instruction deleted successfully.' });
>>>>>>> Stashed changes
    } catch (error) {
      next(error);
    }
  }
}

<<<<<<< Updated upstream
export const instructionController = controllerCache.withCache(new InstructionController(), { namespace: 'work-instructions', ttlSeconds: 300, tags: ['work-instructions', 'work-orders'] });
=======
export const instructionController = new InstructionController();
>>>>>>> Stashed changes
