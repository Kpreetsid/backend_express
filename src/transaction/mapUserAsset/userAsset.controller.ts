import { controllerCache } from '../../_cache/controllerCache.service';
import { Request, Response, NextFunction } from 'express';
import { mapUserToAssetService } from './userAsset.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { AssetModel } from '../../models/asset.model';
import { UserModel } from '../../models/user.model';
import { applyRoleFilter } from '../../utils/roleFilter';

class MapUserAssetController {
  private async validateReferences(body: any[], user: IUser): Promise<void> {
    const assetIds = [...new Set(body.map(item => String(item.assetId)))];
    const userIds = [...new Set(body.map(item => String(item.userId)))];
    const assetFilter = await applyRoleFilter({ user, baseFilter: { _id: { $in: assetIds } }, mapping: 'asset' });
    const [assets, users] = await Promise.all([
      AssetModel.countDocuments(assetFilter),
      UserModel.countDocuments({ _id: { $in: userIds }, account_id: user.account_id, user_status: 'active' })
    ]);
    if (assets !== assetIds.length || users !== userIds.length) {
      throw Object.assign(new Error('Mapping reference is unavailable or outside your scope'), { status: 403 });
    }
  }


  async getUserAssets(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const { account_id, _id: user_id, user_role: userRole } = user;
      const { userId, assetId, populate } = req.query;
      const assetMatch: any = { account_id, visible: true };
      if (assetId) assetMatch._id = { $in: helperService.validateObjectIds(String(assetId)) };
      const assets = await AssetModel.find(assetMatch).select('_id').lean();
      const ownedAssetIds = assets.map(asset => asset._id);
      const match: any = {
        assetId: { $in: ownedAssetIds },
        $or: [{ account_id }, { account_id: { $exists: false } }]
      };
      if (userRole === 'admin') {
        const userMatch: any = { account_id, user_status: 'active' };
        if (userId) userMatch._id = helperService.validateObjectId(String(userId));
        const users = await UserModel.find(userMatch).select('_id').lean();
        match.userId = { $in: users.map(item => item._id) };
      } else {
        match.userId = user_id;
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
      const body = Array.isArray(req.body) ? req.body : (req.body ? [req.body] : []);
      const validatedBody = body.filter((doc: any) => doc.assetId && doc.userId).map((doc: any) => ({
        assetId: helperService.validateObjectId(String(doc.assetId)),
        userId: helperService.validateObjectId(String(doc.userId))
      }));
      if (validatedBody.length === 0) {
        throw Object.assign(new Error('Invalid data'), { status: 400 });
      }
      const user = get(req, 'user', {}) as IUser;
      await this.validateReferences(validatedBody, user);
      await mapUserToAssetService.createMapUserAssets(validatedBody.map(item => ({ ...item, account_id: user.account_id })));
      res.status(201).json({ message: 'User assets mapped successfully' });
    } catch (error) {
      next(error);
    }
  };

  async updateUserAssets(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { params: { assetId }, body } = req;
      if (!assetId || !body || (Array.isArray(body) && body.length === 0) || (!Array.isArray(body) && Object.keys(body).length === 0)) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      const validatedAssetId = helperService.validateObjectId(String(assetId));
      const validatedUserIds = helperService.validateObjectIds(body.userIdList.join(','));
      const user = get(req, 'user', {}) as IUser;
      await this.validateReferences(validatedUserIds.map(userId => ({ assetId: validatedAssetId, userId })), user);
      // Empty replacement lists still need to authorize the target asset.
      if (!await AssetModel.exists(await applyRoleFilter({ user, baseFilter: { _id: validatedAssetId }, mapping: 'asset' }))) {
        throw Object.assign(new Error('Asset is unavailable or outside your scope'), { status: 403 });
      }
      await mapUserToAssetService.updateUserMapping(String(validatedAssetId), validatedUserIds, [], [], undefined, user.account_id);
      res.status(201).json({ status: true, message: 'User asset mappings updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async updateSendMailFlag(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const body = Array.isArray(req.body) ? req.body : (req.body ? [req.body] : []);
      const validatedBody = body.map((item: any) => ({
        ...item,
        _id: helperService.validateObjectId(String(item._id))
      }));
      await mapUserToAssetService.updateMappedUserFlags(validatedBody, get(req, 'user', {}) as IUser);
      return res.status(200).json({ status: true, message: 'Asset mail notification settings updated successfully' });
    } catch (error) {
      next(error);
    }
  };
}

export const userAssetController = controllerCache.withCache(new MapUserAssetController(), { namespace: 'mappings', ttlSeconds: 120, tags: ['mappings', 'assets', 'locations', 'work-orders', 'users'] });
