import express from 'express';
import { getAssetsReport, getAssetsReportById, getLatestReport, createAssetsReport, updateAssetsReport, deleteAssetsReport } from './asset.controller';

export default (router: express.Router) => {
    const assetReportRouter = express.Router();
    assetReportRouter.get('/', getAssetsReport);
    assetReportRouter.get('/latest/:id', getLatestReport);
    assetReportRouter.get('/:id', getAssetsReportById);
    assetReportRouter.post('/', createAssetsReport);
    assetReportRouter.put('/:id', updateAssetsReport);
    assetReportRouter.delete('/:id', deleteAssetsReport);
    router.use('/assets', assetReportRouter);
}