import express from 'express';
import { partsController } from './parts.controller';
import { validateParamId } from '../../middlewares/validate';
import { partValidator } from './part.validator';
import { transferValidator } from './transfer.validator';
import { validate } from '../../middlewares/validator.middleware';
import multer from 'multer';
import path from 'path';
import { uploadFilesService } from '../../upload/upload.multer';
import { payloadCryptoMultipartMiddleware } from '../../middlewares/payloadCrypto.middleware';
import { idempotencyMiddleware } from '../../middlewares/idempotency.middleware';
import { hasRolePermission } from '../../middlewares';

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
    partRouter.get('/', partsController.getParts);
    partRouter.get('/cycle-counts', partsController.getCycleCounts);
    partRouter.get('/replenishment-suggestions', partsController.getReplenishmentSuggestions);
    partRouter.post(
        '/import',
        hasRolePermission('inventory', 'import'),
        importUpload.single('file'),
        payloadCryptoMultipartMiddleware,
        idempotencyMiddleware,
        partsController.importParts
    );
    partRouter.get('/:id/history', validateParamId, partsController.getPartHistory);
    partRouter.get('/:id', validateParamId, partsController.getPart);
    partRouter.post('/cycle-counts', idempotencyMiddleware, hasRolePermission('inventory', 'add'), partsController.createCycleCount);
    partRouter.put('/cycle-counts/:id/approve', idempotencyMiddleware, hasRolePermission('inventory', 'edit'), validateParamId, partsController.approveCycleCount);
    partRouter.post('/', idempotencyMiddleware, hasRolePermission('inventory', 'add'), partValidator, validate, partsController.createPart);
    partRouter.put('/:id', idempotencyMiddleware, hasRolePermission('inventory', 'edit'), validateParamId, partValidator, validate, partsController.updatePart);
    partRouter.patch('/:id', idempotencyMiddleware, hasRolePermission('inventory', 'edit'), validateParamId, partsController.updateStock);
    // Dedicated stock-transfer endpoint — POST body: { destination_part_id, quantity, note }
    partRouter.post('/:id/transfer', idempotencyMiddleware, hasRolePermission('inventory', 'edit'), validateParamId, transferValidator, validate, partsController.transferStock);
    partRouter.delete('/:id', validateParamId, hasRolePermission('inventory', 'delete'), partsController.removePart);
    router.use('/parts', partRouter);
}

