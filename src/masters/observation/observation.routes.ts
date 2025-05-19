import express from 'express';
import { getObservations, getObservation, createObservation, updateObservation, removeObservation } from './observation.controller';

export default (router: express.Router) => {
    router.get('/observations', getObservations);
    router.get('/observation/:id', getObservation);
    router.post('/observation', createObservation);
    router.put('/observation/:id', updateObservation);
    router.delete('/observation/:id', removeObservation);
}