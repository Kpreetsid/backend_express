import express from 'express';
import { observationController } from './observation.controller';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const observationRouter = express.Router();
    observationRouter.get('/', observationController.getObservations);
    observationRouter.get('/:id', observationController.getObservation);
    observationRouter.post('/', hasRolePermission('asset', 'add_observation'), observationController.createObservation);
    observationRouter.put('/:id', observationController.updateObservation);
    observationRouter.delete('/:id', observationController.removeObservation);
    router.use('/observations', observationRouter);
}