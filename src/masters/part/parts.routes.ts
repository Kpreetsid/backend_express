import express from 'express';
import { partsController } from './parts.controller';
import { validateParamId } from '../../middlewares/validate';
import { partValidator } from './part.validator';
import { transferValidator } from './transfer.validator';
import { validate } from '../../middlewares/validator.middleware';
import multer from 'multer';
import path from 'path';
import { payloadCryptoMultipartMiddleware } from '../../middlewares/payloadCrypto.middleware';
import { hasRolePermission } from '../../middlewares';
import { stockAdjustmentValidator } from './stock.validator';
import {
    approveCycleCountValidator,
    createCycleCountValidator,
    cycleCountQueryValidator
} from './cycle-count.validator';


const importUpload = multer({
    // The browser parses the workbook and sends normalized JSON. Keep the
    // original file in memory only long enough to validate the request instead
    // of accumulating unused import files on the API host.
    storage: multer.memoryStorage(),
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

    partRouter.get('/', hasRolePermission('inventory', 'view'), partsController.getParts);
    partRouter.get('/cycle-counts', hasRolePermission('inventory', 'view'), cycleCountQueryValidator, validate, partsController.getCycleCounts);
    partRouter.get('/replenishment-suggestions', hasRolePermission('inventory', 'view'), partsController.getReplenishmentSuggestions);
    partRouter.post('/import', hasRolePermission('inventory', 'import'), importUpload.single('file'), payloadCryptoMultipartMiddleware, partsController.importParts);
    partRouter.get('/:id/history', validateParamId, hasRolePermission('inventory', 'view'), partsController.getPartHistory);
    partRouter.get('/:id', validateParamId, hasRolePermission('inventory', 'view'), partsController.getPart);
    partRouter.post('/cycle-counts', hasRolePermission('inventory', 'edit'), createCycleCountValidator, validate, partsController.createCycleCount);
    partRouter.put('/cycle-counts/:id/approve', validateParamId, hasRolePermission('inventory', 'edit'), approveCycleCountValidator, validate, partsController.approveCycleCount);
    partRouter.post('/', hasRolePermission('inventory', 'add'), partValidator, validate, partsController.createPart);
    partRouter.put('/:id', validateParamId, hasRolePermission('inventory', 'edit'), partValidator, validate, partsController.updatePart);
    partRouter.patch('/:id', validateParamId, hasRolePermission('inventory', 'edit'), stockAdjustmentValidator, validate, partsController.updateStock);

    // Dedicated stock-transfer endpoint — POST body: { destination_part_id, quantity, note }
    partRouter.post('/:id/transfer', validateParamId, hasRolePermission('inventory', 'edit'), transferValidator, validate, partsController.transferStock);
    partRouter.delete('/:id', validateParamId, hasRolePermission('inventory', 'delete'), partsController.removePart);
    router.use('/parts', partRouter);
}


