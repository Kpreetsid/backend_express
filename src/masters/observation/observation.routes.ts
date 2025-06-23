import express from 'express';
import { getObservations, getObservation, createObservation, updateObservation, removeObservation } from './observation.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const observationRouter = express.Router();
    observationRouter.get('/', getObservations);
    observationRouter.get('/:id', getObservation);
    observationRouter.post('/', createObservation);
    observationRouter.put('/:id', updateObservation);
    observationRouter.delete('/:id', hasPermission('admin'),removeObservation);
    router.use('/observations', observationRouter);
}