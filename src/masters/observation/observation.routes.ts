import express from 'express';
import { getObservations, getObservation, getFilteredObservations, createObservation, updateObservation, removeObservation } from './observation.controller';
import { hasPermission } from '../../_config/permission';

export default (router: express.Router) => {
    const observationRouter = express.Router();
    observationRouter.get('/', getObservations);
    observationRouter.get('/filter', getFilteredObservations);
    observationRouter.get('/:id', getObservation);
    observationRouter.post('/', createObservation);
    observationRouter.put('/:id', updateObservation);
    observationRouter.delete('/:id', hasPermission('admin'),removeObservation);
    router.use('/observations', observationRouter);
}