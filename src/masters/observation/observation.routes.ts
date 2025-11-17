import express from 'express';
import { getObservations, getObservation, createObservation, updateObservation, removeObservation } from './observation.controller';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const observationRouter = express.Router();
    observationRouter.get('/', getObservations);
    observationRouter.get('/:id', getObservation);
    observationRouter.post('/', hasRolePermission('asset', 'add_observation'), createObservation);
    observationRouter.put('/:id', updateObservation);
    observationRouter.delete('/:id', removeObservation);
    router.use('/observations', observationRouter);
}