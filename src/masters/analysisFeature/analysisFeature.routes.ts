import express from 'express';
import { analysisFeatureController } from './analysisFeature.controller';
import { validateParamId } from '../../middlewares/validate';
import { validate } from '../../middlewares/validator.middleware';
import { analysisFeatureUpdateValidator } from './analysisFeature.validator';

export default (router: express.Router) => {
    const analysisFeatureRouter = express.Router();
    analysisFeatureRouter.get('/', analysisFeatureController.getFeatureData);
    analysisFeatureRouter.put('/:id', validateParamId, analysisFeatureUpdateValidator, validate, analysisFeatureController.updateFeatureData);
    router.use('/analysis-features', analysisFeatureRouter);
}
