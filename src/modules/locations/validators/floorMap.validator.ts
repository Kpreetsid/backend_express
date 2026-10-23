import { body } from 'express-validator';

export const floorMapValidator = [
  body('coordinate')
    .notEmpty().withMessage('Coordinate is required')
    .isObject().withMessage('Coordinate must be an object'),
  
  body('coordinate.x')
    .notEmpty().withMessage('Coordinate X is required')
    .isNumeric().withMessage('Coordinate X must be a number'),

  body('coordinate.y')
    .notEmpty().withMessage('Coordinate Y is required')
    .isNumeric().withMessage('Coordinate Y must be a number'),

  body('locationId')
    .notEmpty().withMessage('Location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('data_type')
    .notEmpty().withMessage('Data type is required')
    .isIn(['location', 'asset', 'kpi'])
    .withMessage('Invalid data type'),

  body('end_point')
    .optional()
    .isObject().withMessage('End point must be an object'),

  body('end_point.point_name')
    .if(body('end_point').exists())
    .notEmpty().withMessage('Point name is required'),

  body('end_point.asset_name')
    .if(body('end_point').exists())
    .notEmpty().withMessage('Asset name is required')
];
