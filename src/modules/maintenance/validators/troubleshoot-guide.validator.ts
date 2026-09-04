import { body, query } from 'express-validator';
import { sanitizeTroubleshootingPayload } from '../services/guide-payload.service';
import { getGuideContext } from '../services/guide-scope.service';

export const troubleshootGuideQueryValidator = [
  query('assetId').optional().isMongoId().withMessage('Invalid asset ID'),
  query('locationId').optional().isMongoId().withMessage('Invalid location ID'),
  query().custom((value) => {
    getGuideContext(value);
    return true;
  })
];

export const troubleshootGuideValidator = [
  body().custom((value) => {
    sanitizeTroubleshootingPayload(value);
    return true;
  })
];
