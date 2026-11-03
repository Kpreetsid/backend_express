import express from 'express';
import { observationController } from '@modules/assets/controllers/observation.controller';
import { hasRolePermission } from '@common/middlewares';
import { validateParamId } from '@common/middlewares/validate.middleware';
import { observationCreateValidator, observationUpdateValidator } from '@modules/assets/validators/observation.validator';
import { validate } from '@common/middlewares/validator.middleware';

export default (router: express.Router) => {
    const observationRouter = express.Router();
    observationRouter.use(hasRolePermission('asset', 'view'));
    observationRouter.get('/', observationController.getObservations);
    observationRouter.get('/:id', validateParamId, observationController.getObservation);
    observationRouter.post('/', hasRolePermission('asset', 'add_observation'), observationCreateValidator, validate, observationController.createObservation);
    observationRouter.put('/:id', validateParamId, hasRolePermission('asset', 'edit_observation'), observationUpdateValidator, validate, observationController.updateObservation);
    observationRouter.patch('/:id', validateParamId, hasRolePermission('asset', 'edit_observation'), observationUpdateValidator, validate, observationController.updateObservation);
    observationRouter.delete('/:id', validateParamId, hasRolePermission('asset', 'delete_observation'), observationController.removeObservation);
    router.use('/observations', observationRouter);
}
