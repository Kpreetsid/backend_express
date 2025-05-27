import express from 'express';
import { getLocations, getLocation, updateLocation, removeLocation, getKpiFilterLocations, getFilterLocations, getChildAssetsAgainstLocation } from './location.controller';

export default (router: express.Router) => {
    const locationRouter = express.Router();
    locationRouter.get('/', getLocations);
    locationRouter.get('/kpi-filter', getKpiFilterLocations);
    locationRouter.get('/:id', getLocation);
    locationRouter.post('/child-assets', getChildAssetsAgainstLocation);
    locationRouter.post('/filter', getFilterLocations);
    locationRouter.put('/:id', updateLocation);
    locationRouter.delete('/:id', removeLocation);
    router.use('/locations', locationRouter);
}