import express from 'express';
import { assetReportController } from './asset.controller';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const assetReportRouter = express.Router();
    assetReportRouter.get('/', assetReportController.getAssetsReport);
    assetReportRouter.get('/latest/:id', assetReportController.getLatestReport);
    assetReportRouter.get('/:id', assetReportController.getAssetsReportById);
    assetReportRouter.post('/', hasRolePermission('asset', 'create_report'), assetReportController.createAssetsReport);
    assetReportRouter.put('/:id', hasRolePermission('asset', 'edit_report'), assetReportController.updateAssetsReport);
    assetReportRouter.delete('/:id', hasRolePermission('asset', 'delete_report'), assetReportController.deleteAssetsReport);
    router.use('/assets', assetReportRouter);
}