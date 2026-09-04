import { body } from 'express-validator';

export const userLocationValidator = [
  body()
    .isArray({ min: 1 }).withMessage('Request body must be a non-empty array')
    .custom((value) => {
      value.forEach((item: any, index: number) => {
        if (!item.locationId) {
          throw new Error(`Item at index ${index} is missing locationId`);
        }
        if (!item.userId) {
          throw new Error(`Item at index ${index} is missing userId`);
        }
      });
      return true;
    }),
  
  body('*.locationId')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('*.userId')
    .isMongoId().withMessage('Invalid User ID format')
];

export const userLocationUpdateValidator = [
  body('locationId')
    .notEmpty().withMessage('Location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('userIdList')
    .notEmpty().withMessage('User ID list is required')
    .isArray().withMessage('User ID list must be an array'),

  body('userIdList.*')
    .isMongoId().withMessage('Invalid User ID format in list')
];
