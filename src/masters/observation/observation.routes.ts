import express from 'express';
import ObservationController from './observation.controller';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const observationRouter = express.Router();
    observationRouter.get('/', ObservationController.getObservations);
    observationRouter.get('/:id', ObservationController.getObservation);
    observationRouter.post('/', hasRolePermission('asset', 'add_observation'), ObservationController.createObservation);
    observationRouter.put('/:id', ObservationController.updateObservation);
    observationRouter.delete('/:id', ObservationController.removeObservation);
    router.use('/observations', observationRouter);
}