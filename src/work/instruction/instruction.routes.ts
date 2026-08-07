import express from 'express';
import { instructionController } from './instruction.controller';
import { validateParamId } from '../../middlewares/validate';
import { instructionValidator } from './instruction.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasAnyRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const instructionRouter = express.Router();
    instructionRouter.get('/', instructionController.getAll);
    instructionRouter.get('/:id', validateParamId, instructionController.getDataById);
    const canManageKnowledge = hasAnyRolePermission(
        { moduleName: 'asset', action: 'edit_asset' },
        { moduleName: 'location', action: 'edit_location' }
    );
    instructionRouter.post('/', canManageKnowledge, instructionValidator, validate, instructionController.create);
    instructionRouter.put('/:id', validateParamId, canManageKnowledge, instructionValidator, validate, instructionController.update);
    instructionRouter.patch('/:id', validateParamId, canManageKnowledge, instructionValidator, validate, instructionController.update);
    instructionRouter.delete('/:id', validateParamId, canManageKnowledge, instructionController.remove);
    router.use('/instructions', instructionRouter);
}
