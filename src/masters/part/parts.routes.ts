import express from 'express';
import { partsController } from './parts.controller';
import { validateParamId } from '../../middlewares/validate';
import { partValidator } from './part.validator';
import { validate } from '../../middlewares/validator.middleware';
import multer from 'multer';
import path from 'path';
import { uploadFilesService } from '../../upload/upload.multer';

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
    partRouter.post('/import', importUpload.single('file'), partsController.importParts);
    partRouter.get('/:id', validateParamId, partsController.getPart);
    partRouter.post('/cycle-counts', partsController.createCycleCount);
    partRouter.put('/cycle-counts/:id/approve', validateParamId, partsController.approveCycleCount);
    partRouter.post('/', partValidator, validate, partsController.createPart);
    partRouter.put('/:id', validateParamId, partValidator, validate, partsController.updatePart);
    partRouter.patch('/:id', validateParamId, partsController.updateStock);
    partRouter.delete('/:id', validateParamId, partsController.removePart);
    router.use('/parts', partRouter);
}
