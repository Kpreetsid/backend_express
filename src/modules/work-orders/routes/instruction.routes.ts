import express from 'express';
import { hasRolePermission } from '@common/middlewares/permission.middleware';
import { instructionController } from '@modules/work-orders/controllers/instruction.controller';
import { validateParamId } from '@common/middlewares/validate.middleware';
import { instructionValidator } from '@modules/work-orders/validators/instruction.validator';
import { validate } from '@common/middlewares/validator.middleware';

export default (router: express.Router) => {
    const instructionRouter = express.Router();
    instructionRouter.use(hasRolePermission('procedures', 'view'));
    instructionRouter.get('/', instructionController.getAll);
    instructionRouter.get('/:id', validateParamId, instructionController.getDataById);
    instructionRouter.post('/', hasRolePermission('procedures', 'add'), instructionValidator, validate, instructionController.create);
    instructionRouter.put('/:id', validateParamId, hasRolePermission('procedures', 'edit'), instructionValidator, validate, instructionController.update);
    instructionRouter.patch('/:id', validateParamId, hasRolePermission('procedures', 'edit'), instructionValidator, validate, instructionController.update);
    instructionRouter.delete('/:id', validateParamId, hasRolePermission('procedures', 'delete'), instructionController.remove);
    router.use('/instructions', instructionRouter);
}