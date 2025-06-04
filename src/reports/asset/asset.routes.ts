import express from 'express';
import { getAssetsReport } from './asset.controller';

export default (router: express.Router) => {
    const assetReportRouter = express.Router();
    assetReportRouter.get('/', getAssetsReport);
    assetReportRouter.get('/:id', getAssetsReport);
    router.use('/assets', assetReportRouter);
}