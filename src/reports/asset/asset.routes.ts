import express from 'express';
import { getAssetsReport, getLatestReport } from './asset.controller';

export default (router: express.Router) => {
    const assetReportRouter = express.Router();
    assetReportRouter.get('/', getAssetsReport);
    assetReportRouter.get('/latest/:id', getLatestReport);
    assetReportRouter.get('/:id', getAssetsReport);
    router.use('/assets', assetReportRouter);
}