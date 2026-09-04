import express from 'express';
import { analysisFeatureController } from '../controllers/analysisFeature.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { validate } from '../../../common/middlewares/validate.middleware';
import { analysisFeatureUpdateValidator } from '../validators/analysisFeature.validator';

export default (router: express.Router) => {
    const analysisFeatureRouter = express.Router();
    analysisFeatureRouter.get('/', analysisFeatureController.getFeatureData);
    analysisFeatureRouter.put('/:id', validateParamId, analysisFeatureUpdateValidator, validate, analysisFeatureController.updateFeatureData);
    router.use('/analysis-features', analysisFeatureRouter);
}
