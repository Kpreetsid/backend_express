import express from 'express';
import { getLocations, getLocation, updateLocation, getLocationTree, removeLocation, getKpiFilterLocations, getChildAssetsAgainstLocation, createLocation, updateLocationFloorMapImage, getLocationSensorList } from './location.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const locationRouter = express.Router();
    locationRouter.get('/', getLocations);
    locationRouter.get('/tree', getLocationTree);
    locationRouter.get('/sensor-list', getLocationSensorList);
    locationRouter.get('/kpi-filter', getKpiFilterLocations);
    locationRouter.get('/:id', getLocation);
    locationRouter.post('/', createLocation);
    locationRouter.post('/child-assets', getChildAssetsAgainstLocation);
    locationRouter.put('/floor-map-image/:id', updateLocationFloorMapImage);
    locationRouter.put('/:id', updateLocation);
    locationRouter.delete('/:id', hasPermission('admin'), removeLocation);
    router.use('/locations', locationRouter);
}