import express from 'express';
import { analysisFeatureController } from './analysisFeature.controller';

export default (router: express.Router) => {
    const analysisFeatureRouter = express.Router();
    analysisFeatureRouter.get('/', analysisFeatureController.getFeatureData);
    analysisFeatureRouter.put('/:id', analysisFeatureController.updateFeatureData);
    router.use('/analysis-features', analysisFeatureRouter);
}