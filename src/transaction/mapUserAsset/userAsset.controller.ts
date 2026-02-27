import { Request, Response, NextFunction } from 'express';
import { mapUserToAssetService } from './userAsset.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { AssetModel } from '../../models/asset.model';

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
        const assetMatch: any = { account_id, visible: true };
        if (assetId) {
          assetMatch._id = helperService.validateObjectId(String(assetId));
        }
        const assetIds = await AssetModel.find(assetMatch).distinct('_id');
        if (!assetIds || assetIds.length === 0) {
          throw Object.assign(new Error('No assets found'), { status: 404 });
        }
        match.assetId = { $in: assetIds };
      } else {
        match.userId = user_id;
        if (assetId) {
          match.assetId = helperService.validateObjectId(String(assetId));
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
      const validatedBody = req.body.filter((doc: any) => doc.assetId && doc.userId).map((doc: any) => ({
        assetId: helperService.validateObjectId(String(doc.assetId)),
        userId: helperService.validateObjectId(String(doc.userId))
      }));
      if (validatedBody.length === 0) {
        throw Object.assign(new Error('Invalid data'), { status: 400 });
      }
      await mapUserToAssetService.createMapUserAssets(validatedBody);
      res.status(201).json({ message: 'User assets mapped successfully' });
    } catch (error) {
      next(error);
    }
  };

  async updateUserAssets(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { params: { assetId }, body } = req;
      if (!assetId || body.length === 0) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      const validatedAssetId = helperService.validateObjectId(String(assetId));
      const validatedUserIds = helperService.validateObjectIds(body.userIdList.join(','));
      await mapUserToAssetService.updateUserMapping(String(validatedAssetId), validatedUserIds);
      res.status(201).json({ status: true, message: 'User asset mappings updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async updateSendMailFlag(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const validatedBody = req.body.map((item: any) => ({
        ...item,
        _id: helperService.validateObjectId(String(item._id))
      }));
      await mapUserToAssetService.updateMappedUserFlags(validatedBody);
      return res.status(200).json({ status: true, message: 'Asset mail notification settings updated successfully' });
    } catch (error) {
      next(error);
    }
  };
}

export const userAssetController = new MapUserAssetController();