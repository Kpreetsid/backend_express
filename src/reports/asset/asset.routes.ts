import express from 'express';
import multer from 'multer';
import { assetReportController } from './asset.controller';
import { hasRolePermission } from '../../middlewares';
import { validateParamId } from '../../middlewares/validate';

const pdfChartUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: 60,
        fileSize: 2 * 1024 * 1024,
        fieldSize: 2 * 1024 * 1024
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/svg+xml') {
            cb(null, true);
            return;
        }
        cb(Object.assign(new Error('Only SVG, PNG, and JPEG chart snapshots are allowed'), { status: 400 }));
    }
});

export default (router: express.Router) => {
    const assetReportRouter = express.Router();
    assetReportRouter.get('/', assetReportController.getAssetsReport);
    assetReportRouter.get('/latest/:id', validateParamId, assetReportController.getLatestReport);
    assetReportRouter.get('/:id', validateParamId, assetReportController.getAssetsReportById);
    assetReportRouter.post('/', hasRolePermission('asset', 'create_report'), assetReportController.createAssetsReport);
    assetReportRouter.post('/generate-pdf/:id', validateParamId, pdfChartUpload.array('chartImages', 60), assetReportController.generateAssetReportPdf);
    assetReportRouter.put('/:id', validateParamId, hasRolePermission('asset', 'edit_report'), assetReportController.updateAssetsReport);
    assetReportRouter.patch('/:id', validateParamId, hasRolePermission('asset', 'edit_report'), assetReportController.partialUpdateAssetsReport);
    assetReportRouter.delete('/:id', validateParamId, hasRolePermission('asset', 'delete_report'), assetReportController.deleteAssetsReport);
    router.use('/assets', assetReportRouter);
}
