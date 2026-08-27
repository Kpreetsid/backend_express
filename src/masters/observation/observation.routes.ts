import express from 'express';
import { observationController } from './observation.controller';
import { hasRolePermission } from '../../middlewares';
import { validateParamId } from '../../middlewares/validate';
import { observationCreateValidator, observationUpdateValidator } from './observation.validator';
import { validate } from '../../middlewares/validator.middleware';

export default (router: express.Router) => {
    const observationRouter = express.Router();
    observationRouter.get('/', observationController.getObservations);
    observationRouter.get('/:id', validateParamId, observationController.getObservation);
    observationRouter.post('/', hasRolePermission('asset', 'add_observation'), observationCreateValidator, validate, observationController.createObservation);
    observationRouter.put('/:id', hasRolePermission('asset', 'add_observation'), validateParamId, observationUpdateValidator, validate, observationController.updateObservation);
    observationRouter.patch('/:id', hasRolePermission('asset', 'add_observation'), validateParamId, observationUpdateValidator, validate, observationController.updateObservation);
    observationRouter.delete('/:id', hasRolePermission('asset', 'add_observation'), validateParamId, observationController.removeObservation);
    router.use('/observations', observationRouter);
}
<<<<<<< Updated upstream

=======
>>>>>>> Stashed changes
