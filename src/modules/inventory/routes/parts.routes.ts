import express from 'express';
import { hasRolePermission } from '@common/middlewares/permission.middleware';
import { partsController } from '@modules/inventory/controllers/parts.controller';
import { validateParamId } from '@common/middlewares/validate.middleware';
import { partValidator } from '@modules/inventory/validators/part.validator';
import { transferValidator } from '@modules/inventory/validators/transfer.validator';
import { validate } from '@common/middlewares/validator.middleware';
import multer from 'multer';
import path from 'path';
import { uploadFilesService } from '@modules/upload/middlewares/upload.multer';
import { payloadCryptoMultipartMiddleware } from '@common/middlewares/payload-crypto.middleware';
import { idempotencyMiddleware } from '@common/middlewares/idempotency.middleware';

const importStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadFilesService.getDestinationPath('parts_imports'));
    },
    filename: function (req, file, cb) {
        const accountId = (req as any).user?.account_id;
        const ext = path.extname(file.originalname);
        cb(null, uploadFilesService.generateFileName(ext, 'parts-import', accountId));
    }
});

const importUpload = multer({
    storage: importStorage,
    limits: { files: 1, fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.csv', '.xlsx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (!allowedTypes.includes(ext)) {
            return cb(new Error('Invalid file type. Please upload .csv or .xlsx files.'));
        }
        cb(null, true);
    }
});

export default (router: express.Router) => {
    const partRouter = express.Router();
    partRouter.use(idempotencyMiddleware);
    partRouter.use(hasRolePermission('inventory', 'view'));
    partRouter.get('/', partsController.getParts);
    partRouter.get('/cycle-counts', partsController.getCycleCounts);
    partRouter.get('/replenishment-suggestions', partsController.getReplenishmentSuggestions);
    partRouter.post('/import', hasRolePermission('inventory', 'import'), importUpload.single('file'), payloadCryptoMultipartMiddleware, partsController.importParts);
    partRouter.get('/:id/history', validateParamId, partsController.getPartHistory);
    partRouter.get('/:id', validateParamId, partsController.getPart);
    partRouter.post('/cycle-counts', hasRolePermission('inventory', 'add'), partsController.createCycleCount);
    partRouter.put('/cycle-counts/:id/approve', validateParamId, hasRolePermission('inventory', 'edit'), partsController.approveCycleCount);
    partRouter.post('/', hasRolePermission('inventory', 'add'), partValidator, validate, partsController.createPart);
    partRouter.put('/:id', validateParamId, hasRolePermission('inventory', 'edit'), partValidator, validate, partsController.updatePart);
    partRouter.patch('/:id', validateParamId, hasRolePermission('inventory', 'edit'), partsController.updateStock);
    // Dedicated stock-transfer endpoint — POST body: { destination_part_id, quantity, note }
    partRouter.post('/:id/transfer', validateParamId, hasRolePermission('inventory', 'edit'), transferValidator, validate, partsController.transferStock);
    partRouter.delete('/:id', validateParamId, hasRolePermission('inventory', 'delete'), partsController.removePart);
    router.use('/parts', partRouter);
}


