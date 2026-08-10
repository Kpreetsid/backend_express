import express from 'express';
import { observationController } from './observation.controller';
import { hasAccountFeature, hasRolePermission } from '../../middlewares';
import { validateParamId } from '../../middlewares/validate';
import { observationValidator } from './observation.validator';
import { validate } from '../../middlewares/validator.middleware';

export default (router: express.Router) => {
    const observationRouter = express.Router();
    observationRouter.get('/', observationController.getObservations);
    observationRouter.get('/:id', validateParamId, observationController.getObservation);
    observationRouter.post('/', hasAccountFeature('observation', 'add'), hasRolePermission('asset', 'add_observation'), observationValidator, validate, observationController.createObservation);
    observationRouter.put('/:id', hasAccountFeature('observation', 'edit'), validateParamId, observationValidator, observationController.updateObservation);
    observationRouter.patch('/:id', hasAccountFeature('observation', 'edit'), validateParamId, observationValidator, observationController.updateObservation);
    observationRouter.delete('/:id', hasAccountFeature('observation', 'delete'), validateParamId, observationController.removeObservation);
    router.use('/observations', observationRouter);
}
