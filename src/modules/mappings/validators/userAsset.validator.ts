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
    .isArray().withMessage('User ID list must be an array'),

  body('userIdList.*')
    .isMongoId().withMessage('Invalid User ID format in list')
];

export const userAssetMailFlagsValidator = [
  body()
    .isArray({ min: 1, max: 500 }).withMessage('Request body must contain between 1 and 500 mappings'),
  body('*._id')
    .isMongoId().withMessage('Every mapping must have a valid ID'),
  body('*.alert')
    .isBoolean().withMessage('Alert must be a boolean'),
  body('*.danger')
    .isBoolean().withMessage('Danger must be a boolean'),
  body('*.critical')
    .isBoolean().withMessage('Critical must be a boolean')
];
