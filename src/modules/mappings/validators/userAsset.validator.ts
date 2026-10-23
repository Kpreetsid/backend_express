import { body } from 'express-validator';

export const userAssetValidator = [
  body()
    .isArray({ min: 1 }).withMessage('Request body must be a non-empty array')
    .custom((value) => {
      value.forEach((item: any, index: number) => {
        if (!item.assetId) {
          throw new Error(`Item at index ${index} is missing assetId`);
        }
        if (!item.userId) {
          throw new Error(`Item at index ${index} is missing userId`);
        }
      });
      return true;
    }),
  
  body('*.assetId')
    .isMongoId().withMessage('Invalid Asset ID format'),

  body('*.userId')
    .isMongoId().withMessage('Invalid User ID format')
];

export const userAssetUpdateValidator = [
  body('userIdList')
    .notEmpty().withMessage('User ID list is required')
    .isArray().withMessage('User ID list must be an array'),

  body('userIdList.*')
    .isMongoId().withMessage('Invalid User ID format in list')
];
