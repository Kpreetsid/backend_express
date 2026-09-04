import { controllerCache } from '../../../core/cache/controller-cache.service';
import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { IUser } from '../../users/models/user.model';
import { helperService } from '../../../common/utils/object-id.helper';
import { sanitizeTroubleshootingPayload } from '../services/guide-payload.service';
import {
  assertGuideMutationPermission,
  assertGuideTargetAccessible,
  assertSameGuideContext
} from '../services/guide-scope.service';
import { troubleshootGuideService } from '../services/troubleshoot-guide.service';

class TroubleshootGuideController {
  async getAllData(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const context = await assertGuideTargetAccessible(user, req.query);
      const data = await troubleshootGuideService.getAllTroubleshootGuide({
        account_id: user.account_id,
        [context.field]: context.id
      });
      return res.status(200).json({ status: true, message: 'Troubleshoot guides fetched successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async getDataByID(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const guideId = helperService.validateObjectId(req.params.id);
      const data = await troubleshootGuideService.getAllTroubleshootGuide({ _id: guideId, account_id: user.account_id });
      if (!data.length) {
        throw Object.assign(new Error('Troubleshoot guide not found'), { status: 404 });
      }
      await assertGuideTargetAccessible(user, data[0]);
      return res.status(200).json({ status: true, message: 'Troubleshoot guide fetched successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async createData(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      assertGuideMutationPermission(req, req.body);
      const payload = sanitizeTroubleshootingPayload(req.body);
      await assertGuideTargetAccessible(user, payload);
      const data = await troubleshootGuideService.insertTroubleshootGuide(payload, user.account_id, user._id);
      return res.status(201).json({ status: true, message: 'Troubleshoot guide created successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async updateData(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const guideId = helperService.validateObjectId(req.params.id);
      const existing = await troubleshootGuideService.getAllTroubleshootGuide({ _id: guideId, account_id: user.account_id });
      if (!existing.length) {
        throw Object.assign(new Error('Troubleshoot guide not found'), { status: 404 });
      }
      assertGuideMutationPermission(req, existing[0]);
      await assertGuideTargetAccessible(user, existing[0]);
      const payload = sanitizeTroubleshootingPayload(req.body);
      assertSameGuideContext(existing[0], payload);
      const data = await troubleshootGuideService.updateTroubleshootGuide(
        { _id: guideId, account_id: user.account_id },
        payload,
        user._id
      );
      if (!data) {
        throw Object.assign(new Error('Troubleshoot guide not found'), { status: 404 });
      }
      return res.status(200).json({ status: true, message: 'Troubleshoot guide updated successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async removeData(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const guideId = helperService.validateObjectId(req.params.id);
      const existing = await troubleshootGuideService.getAllTroubleshootGuide({ _id: guideId, account_id: user.account_id });
      if (!existing.length) {
        throw Object.assign(new Error('Troubleshoot guide not found'), { status: 404 });
      }
      assertGuideMutationPermission(req, existing[0]);
      await assertGuideTargetAccessible(user, existing[0]);
      const data = await troubleshootGuideService.removeTroubleshootGuide(
        { _id: guideId, account_id: user.account_id },
        user._id
      );
      if (!data) {
        throw Object.assign(new Error('Troubleshoot guide not found'), { status: 404 });
      }
      return res.status(200).json({ status: true, message: 'Troubleshoot guide deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}


export const troubleshootGuideController = controllerCache.withCache(new TroubleshootGuideController(), { namespace: 'troubleshoot-guides', ttlSeconds: 600, tags: ['troubleshoot-guides'] });

