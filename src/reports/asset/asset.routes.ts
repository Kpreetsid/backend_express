import express from 'express';
import { getAssetsReport, getAssetsReportById, getLatestReport, createAssetsReport, updateAssetsReport, deleteAssetsReport } from './asset.controller';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const assetReportRouter = express.Router();
    assetReportRouter.get('/', getAssetsReport);
    assetReportRouter.get('/latest/:id', getLatestReport);
    assetReportRouter.get('/:id', getAssetsReportById);
    assetReportRouter.post('/', hasRolePermission('asset', 'create_report'), createAssetsReport);
    assetReportRouter.put('/:id', hasRolePermission('asset', 'edit_report'), updateAssetsReport);
    assetReportRouter.delete('/:id', hasRolePermission('asset', 'delete_report'), deleteAssetsReport);
    router.use('/assets', assetReportRouter);
}