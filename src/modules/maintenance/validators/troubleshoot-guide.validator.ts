import { body, query } from 'express-validator';
import { sanitizeTroubleshootingPayload } from '../../../common/utils/guidePayload';
import { getGuideContext } from '../../../common/utils/guideScope';

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
