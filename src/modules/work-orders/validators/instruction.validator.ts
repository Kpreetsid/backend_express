import { body, query } from 'express-validator';
import { sanitizeInstructionPayload } from '../../maintenance/services/guide-payload.service';
import { getGuideContext } from '../../maintenance/services/guide-scope.service';

export const instructionQueryValidator = [
  query('assetId').optional().isMongoId().withMessage('Invalid asset ID'),
  query('locationId').optional().isMongoId().withMessage('Invalid location ID'),
  query().custom((value) => {
    getGuideContext(value);
    return true;
  })
];

export const instructionValidator = [
  body().custom((value) => {
    sanitizeInstructionPayload(value);
    return true;
  })
];
