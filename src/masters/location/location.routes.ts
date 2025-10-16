import express from 'express';
import { getLocations, getLocation, updateLocation, getChildLocation, getLocationTree, removeLocation, createDuplicateLocation, getKpiFilterLocations, getChildAssetsAgainstLocation, createLocation, updateLocationFloorMapImage, getLocationSensorList } from './location.controller';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const locationRouter = express.Router();
    locationRouter.get('/', getLocations);
    locationRouter.get('/tree', getLocationTree);
    locationRouter.get('/sensor-list', getLocationSensorList);
    locationRouter.get('/kpi-filter', getKpiFilterLocations);
    locationRouter.get('/child/:id', getChildLocation);
    locationRouter.get('/make-copy/:id', createDuplicateLocation);
    locationRouter.get('/:id', getLocation);
    locationRouter.post('/', hasRolePermission('location', 'add_location'), createLocation);
    locationRouter.post('/child-assets', hasRolePermission('location', 'add_child_location'), getChildAssetsAgainstLocation);
    locationRouter.put('/floor-map-image/:id', updateLocationFloorMapImage);
    locationRouter.put('/:id', hasRolePermission('location', 'edit_location'), updateLocation);
    locationRouter.delete('/:id', hasRolePermission('location', 'delete_location'), removeLocation);
    router.use('/locations', locationRouter);
}