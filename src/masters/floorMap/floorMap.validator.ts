import { body } from 'express-validator';

export const floorMapValidator = [
  body('coordinate')
    .notEmpty().withMessage('Coordinate is required')
    .isObject().withMessage('Coordinate must be an object'),
  
  body('coordinate.x')
    .exists({ values: 'null' }).withMessage('Coordinate X is required')
    .isFloat({ min: 0, max: 10000 }).withMessage('Coordinate X must be between 0 and 10000')
    .toFloat(),

  body('coordinate.y')
    .exists({ values: 'null' }).withMessage('Coordinate Y is required')
    .isFloat({ min: 0, max: 10000 }).withMessage('Coordinate Y must be between 0 and 10000')
    .toFloat(),

  body('locationId')
    .notEmpty().withMessage('Location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('data_type')
    .notEmpty().withMessage('Data type is required')
    .isIn(['location', 'asset', 'kpi'])
    .withMessage('Invalid data type'),

  body('end_point_id')
    .if(body('data_type').equals('asset'))
    .exists({ values: 'null' }).withMessage('End point ID is required')
    .bail()
    .isInt({ min: 0, max: Number.MAX_SAFE_INTEGER }).withMessage('Invalid end point ID')
    .toInt(),

  body('end_point')
    .if(body('data_type').equals('asset'))
    .exists({ values: 'null' }).withMessage('End point is required')
    .bail()
    .isObject().withMessage('End point must be an object'),

  body('end_point.point_name')
    .if(body('data_type').equals('asset'))
    .trim()
    .notEmpty().withMessage('Point name is required')
    .isLength({ max: 200 }).withMessage('Point name is too long'),

  body('end_point.asset_name')
    .if(body('data_type').equals('asset'))
    .trim()
    .notEmpty().withMessage('Asset name is required')
    .isLength({ max: 200 }).withMessage('Asset name is too long'),

  body('end_point.id')
    .if(body('data_type').equals('asset'))
    .isInt({ min: 0, max: Number.MAX_SAFE_INTEGER }).withMessage('Invalid end point payload ID')
    .toInt(),

  body('end_point.asset_id')
    .if(body('data_type').equals('asset'))
    .custom(value => (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim().length > 0 && value.length <= 200))
    .withMessage('Invalid endpoint asset ID'),

  body('end_point.org_id')
    .if(body('data_type').equals('asset'))
    .custom(value => (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim().length > 0 && value.length <= 200))
    .withMessage('Invalid endpoint organization ID'),

  body('end_point.composite_id').optional({ nullable: true }).trim().isLength({ max: 300 }),
  body('end_point.mount_location').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('end_point.mount_type').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('end_point.mount_material').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('end_point.mount_direction').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('end_point.mac_id').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('end_point.image').optional({ nullable: true }).trim().isLength({ max: 1000 }),
  body('end_point.online').optional({ nullable: true }).trim().isLength({ max: 50 })
];
