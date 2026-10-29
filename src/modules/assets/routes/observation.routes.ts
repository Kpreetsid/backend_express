import express from 'express';
import { observationController } from '../controllers/observation.controller';
import { hasRolePermission } from '../../../common/middlewares/index';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { observationValidator } from '../validators/observation.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

export default (router: express.Router) => {
    const observationRouter = express.Router();
    observationRouter.use(hasRolePermission('asset', 'view'));
    observationRouter.get('/', observationController.getObservations);
    observationRouter.get('/:id', validateParamId, observationController.getObservation);
    observationRouter.post('/', hasRolePermission('asset', 'add_observation'), observationValidator, validate, observationController.createObservation);
    observationRouter.put('/:id', validateParamId, hasRolePermission('asset', 'edit_observation'), observationValidator, observationController.updateObservation);
    observationRouter.patch('/:id', validateParamId, hasRolePermission('asset', 'edit_observation'), observationValidator, observationController.updateObservation);
    observationRouter.delete('/:id', validateParamId, hasRolePermission('asset', 'delete_observation'), observationController.removeObservation);
    router.use('/observations', observationRouter);
}

