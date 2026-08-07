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

export const userAssetMailFlagValidator = [
  body()
    .isArray({ min: 1 }).withMessage('Request body must be a non-empty array'),
  body('*._id')
    .isMongoId().withMessage('Invalid mapping ID format'),
  body('*.sendMail')
    .isBoolean().withMessage('sendMail must be a boolean'),
  body('*.alert')
    .isBoolean().withMessage('alert must be a boolean'),
  body('*.danger')
    .isBoolean().withMessage('danger must be a boolean'),
  body('*.critical')
    .isBoolean().withMessage('critical must be a boolean')
];
