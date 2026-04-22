import express from 'express';
import { assetReportController } from './asset.controller';
import { hasRolePermission } from '../../middlewares';
import { validateParamId } from '../../middlewares/validate';

export default (router: express.Router) => {
    const assetReportRouter = express.Router();
    assetReportRouter.get('/', assetReportController.getAssetsReport);
    assetReportRouter.get('/latest/:id', validateParamId, assetReportController.getLatestReport);
    assetReportRouter.get('/:id', validateParamId, assetReportController.getAssetsReportById);
    assetReportRouter.post('/', hasRolePermission('asset', 'create_report'), assetReportController.createAssetsReport);
    assetReportRouter.post('/generate-pdf', assetReportController.generateAssetReportPdf);
    assetReportRouter.put('/:id', validateParamId, hasRolePermission('asset', 'edit_report'), assetReportController.updateAssetsReport);
    assetReportRouter.patch('/:id', validateParamId, hasRolePermission('asset', 'edit_report'), assetReportController.partialUpdateAssetsReport);
    assetReportRouter.delete('/:id', validateParamId, hasRolePermission('asset', 'delete_report'), assetReportController.deleteAssetsReport);
    router.use('/assets', assetReportRouter);
}