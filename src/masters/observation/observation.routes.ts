import express from 'express';
import { observationController } from './observation.controller';
import { hasRolePermission } from '../../middlewares';
import { validateParamId } from '../../middlewares/validate';
import { observationValidator } from './observation.validator';
import { validate } from '../../middlewares/validator.middleware';

export default (router: express.Router) => {
    const observationRouter = express.Router();
    observationRouter.get('/', observationController.getObservations);
    observationRouter.get('/:id', validateParamId, observationController.getObservation);
    observationRouter.post('/', hasRolePermission('asset', 'add_observation'), observationValidator, validate, observationController.createObservation);
    observationRouter.put('/:id', validateParamId, observationValidator, validate, observationController.updateObservation);
    observationRouter.patch('/:id', validateParamId, observationValidator, validate, observationController.updateObservation);
    observationRouter.delete('/:id', validateParamId, observationController.removeObservation);
    router.use('/observations', observationRouter);
}