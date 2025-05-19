import express from 'express';
import { getLocations, getLocation, updateLocation, removeLocation } from './location.controller';

export default (router: express.Router) => {
    router.get('/locations', getLocations);
    router.get('/location/:id', getLocation);
    router.put('/location/:id', updateLocation);
    router.delete('/location/:id', removeLocation);
}