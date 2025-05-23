import express from 'express';
import { getLocations, getLocation, updateLocation, removeLocation, getKpiFilterLocations, getFilterLocations, getChildAssetsAgainstLocation } from './location.controller';

export default (router: express.Router) => {
    router.get('/locations', getLocations);
    router.get('/getKPIFilterLocations', getKpiFilterLocations);
    router.get('/location/:id', getLocation);
    router.post('/location', updateLocation);
    router.post('/getChildAssetsAgainstLocation', getChildAssetsAgainstLocation)
    router.post('/locationFilter', getFilterLocations);
    router.put('/location/:id', updateLocation);
    router.delete('/location/:id', removeLocation);
}