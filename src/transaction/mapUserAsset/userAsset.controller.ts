import { Request, Response, NextFunction } from 'express';
import { mapUserToAssetService } from './userAsset.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { AssetModel } from '../../models/asset.model';
import { UserModel } from '../../models/user.model';

const uniqueIds = (ids: any[]): any[] => {
  return Array.from(new Map(ids.map((id) => [String(id), id])).values());
};

const assertTenantAssets = async (assetIds: any[], accountId: any): Promise<void> => {
  const uniqueAssetIds = uniqueIds(assetIds);
  const count = await AssetModel.countDocuments({
    _id: { $in: uniqueAssetIds },
    account_id: accountId,
    visible: true
  });
  if (count !== uniqueAssetIds.length) {
    throw Object.assign(new Error('Asset not found'), { status: 404 });
  }
};

const assertTenantUsers = async (userIds: any[], accountId: any): Promise<void> => {
  const uniqueUserIds = uniqueIds(userIds);
  const count = await UserModel.countDocuments({
    _id: { $in: uniqueUserIds },
    account_id: accountId
  });
  if (count !== uniqueUserIds.length) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }
};

class MapUserAssetController {

  async getUserAssets(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const { userId, assetId, populate } = req.query;
      const match: any = { assetId: { $exists: true } };
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
      if (userId) {
        const requestedUserId = helperService.validateObjectId(String(userId));
        if (userRole === 'admin') {
          await assertTenantUsers([requestedUserId], account_id);
          match.userId = requestedUserId;
        }
      }
      if (userRole !== 'admin') {
        match.userId = user_id;
      }
      const data = await mapUserToAssetService.userAssets(match, populate, account_id);
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
      await assertTenantAssets(validatedBody.map((doc: any) => doc.assetId), account_id);
      await assertTenantUsers(validatedBody.map((doc: any) => doc.userId), account_id);
      await mapUserToAssetService.createMapUserAssets(validatedBody);
      res.status(201).json({ message: 'User assets mapped successfully' });
    } catch (error) {
      next(error);
    }
  };

  async updateUserAssets(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { params: { assetId }, body } = req;
      const requestedAssetId = assetId || body?.assetId;
      if (!requestedAssetId || !body || !Array.isArray(body.userIdList)) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      const validatedAssetId = helperService.validateObjectId(String(requestedAssetId));
      const validatedUserIds = helperService.validateObjectIds(body.userIdList.join(','));
      await assertTenantAssets([validatedAssetId], account_id);
      if (validatedUserIds.length > 0) {
        await assertTenantUsers(validatedUserIds, account_id);
      }
      await mapUserToAssetService.updateUserMapping(
        String(validatedAssetId),
        validatedUserIds.map(String),
        [],
        [],
        undefined,
        account_id
      );
      res.status(201).json({ status: true, message: 'User asset mappings updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async updateSendMailFlag(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const body = Array.isArray(req.body) ? req.body : (req.body ? [req.body] : []);
      const validatedBody = body.map((item: any) => ({
        _id: helperService.validateObjectId(String(item._id)),
        sendMail: item.sendMail,
        alert: item.alert,
        danger: item.danger,
        critical: item.critical
      }));
      if (validatedBody.length === 0) {
        throw Object.assign(new Error('Invalid data'), { status: 400 });
      }
      const mappingIds = uniqueIds(validatedBody.map((item: any) => item._id));
      const mappings = await mapUserToAssetService.getMappingsByIds(mappingIds);
      if (mappings.length !== mappingIds.length) {
        throw Object.assign(new Error('Asset mapping not found'), { status: 404 });
      }
      await assertTenantAssets(mappings.map((mapping: any) => mapping.assetId), account_id);
      await assertTenantUsers(mappings.map((mapping: any) => mapping.userId), account_id);
      await mapUserToAssetService.updateMappedUserFlags(validatedBody, mappings);
      return res.status(200).json({ status: true, message: 'Asset mail notification settings updated successfully' });
    } catch (error) {
      next(error);
    }
  };
}

export const userAssetController = new MapUserAssetController();
