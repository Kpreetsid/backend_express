import { controllerCache } from '../../_cache/controllerCache.service';
import { Request, Response, NextFunction } from 'express';
import { mapUserToAssetService } from './userAsset.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { AssetModel } from '../../models/asset.model';
import { UserModel } from '../../models/user.model';

class MapUserAssetController {

  async getUserAssets(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const { userId, assetId, populate } = req.query;
      const match: any = { assetId: { $exists: true } };
      if (userId) {
        match.userId = helperService.validateObjectId(String(userId));
      }
      if (userRole === 'admin') {
        if (userId) {
          const targetUser = await UserModel.exists({
            _id: helperService.validateObjectId(String(userId)),
            account_id
          });
          if (!targetUser) {
            throw Object.assign(new Error('User not found in this account'), { status: 404 });
          }
        }
        const assetMatch: any = { account_id, visible: true };
        if (assetId) {
          const ids = helperService.validateObjectIds(String(assetId));
          assetMatch._id = { $in: ids };
        }
        const assetIds = await AssetModel.find(assetMatch).distinct('_id');
        if (!assetIds || assetIds.length === 0) {
          throw Object.assign(new Error('No assets found'), { status: 404 });
        }
        match.assetId = { $in: assetIds };
      } else {
        match.userId = user_id;
        if (assetId) {
          const ids = helperService.validateObjectIds(String(assetId));
          match.assetId = { $in: ids };
        }
      }
      const data = await mapUserToAssetService.userAssets(match, populate);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('User asset mapping not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "User asset mappings fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  async setUserAssets(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const body = Array.isArray(req.body) ? req.body : (req.body ? [req.body] : []);
      const validatedBody = body.filter((doc: any) => doc.assetId && doc.userId).map((doc: any) => ({
        assetId: helperService.validateObjectId(String(doc.assetId)),
        userId: helperService.validateObjectId(String(doc.userId)),
        account_id
      }));
      if (validatedBody.length === 0) {
        throw Object.assign(new Error('Invalid data'), { status: 400 });
      }
      const uniqueMappings = [...new Map(validatedBody.map(mapping => [
        `${mapping.assetId}:${mapping.userId}`,
        mapping
      ])).values()];
      await mapUserToAssetService.assertMappingsBelongToAccount(uniqueMappings, account_id);
      await mapUserToAssetService.createMapUserAssets(uniqueMappings);
      res.status(201).json({ message: 'User assets mapped successfully' });
    } catch (error) {
      next(error);
    }
  };

  async updateUserAssets(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { params: { assetId }, body } = req;
      if (!assetId || !body || (Array.isArray(body) && body.length === 0) || (!Array.isArray(body) && Object.keys(body).length === 0)) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      const validatedAssetId = helperService.validateObjectId(String(assetId));
      const validatedUserIds = body.userIdList.length
        ? helperService.validateObjectIds(body.userIdList)
        : [];
      await mapUserToAssetService.assertAssetAndUsersBelongToAccount(validatedAssetId, validatedUserIds, account_id);
      await mapUserToAssetService.updateUserMapping(String(validatedAssetId), validatedUserIds);
      res.status(201).json({ status: true, message: 'User asset mappings updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async updateSendMailFlag(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      if (!user?._id || user.user_role !== 'admin') {
        throw Object.assign(new Error('Account administrator access is required'), { status: 403 });
      }
      const body = Array.isArray(req.body) ? req.body : (req.body ? [req.body] : []);
      const validatedBody = body.map((item: any) => ({
        _id: helperService.validateObjectId(String(item._id)),
        alert: item.alert,
        danger: item.danger,
        critical: item.critical,
        sendMail: item.alert || item.danger || item.critical
      }));
      await mapUserToAssetService.updateMappedUserFlags(validatedBody, user.account_id);
      return res.status(200).json({ status: true, message: 'Asset mail notification settings updated successfully' });
    } catch (error) {
      next(error);
    }
  };
}

<<<<<<< Updated upstream
export const userAssetController = controllerCache.withCache(new MapUserAssetController(), { namespace: 'mappings', ttlSeconds: 120, tags: ['mappings', 'assets', 'locations', 'work-orders', 'users'] });
=======
export const userAssetController = new MapUserAssetController();
>>>>>>> Stashed changes
