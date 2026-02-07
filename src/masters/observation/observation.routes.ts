import express from 'express';
import { observationController } from './observation.controller';
import { hasRolePermission } from '../../middlewares';
import { validateParamId } from '../../middlewares/validate';

export default (router: express.Router) => {
    const observationRouter = express.Router();
    observationRouter.get('/', observationController.getObservations);
    observationRouter.get('/:id', validateParamId, observationController.getObservation);
    observationRouter.post('/', hasRolePermission('asset', 'add_observation'), observationController.createObservation);
    observationRouter.put('/:id', validateParamId, observationController.updateObservation);
    observationRouter.patch('/:id', validateParamId, observationController.updateObservation);
    observationRouter.delete('/:id', validateParamId, observationController.removeObservation);
    router.use('/observations', observationRouter);
}