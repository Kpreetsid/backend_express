import express from 'express';
import { getLocations, getLocation, updateLocation, getLocationTree, removeLocation, createDuplicateLocation, getKpiFilterLocations, getChildAssetsAgainstLocation, createLocation, updateLocationFloorMapImage, getLocationSensorList } from './location.controller';
// import { hasPermission } from '../../middlewares';
import { hasModulePermission } from '../../middlewares';

export default (router: express.Router) => {
    const locationRouter = express.Router();
    locationRouter.get('/', getLocations);
    locationRouter.get('/tree', getLocationTree);
    locationRouter.get('/sensor-list', getLocationSensorList);
    locationRouter.get('/kpi-filter', getKpiFilterLocations);
    locationRouter.get('/make-copy/:id', createDuplicateLocation);
    locationRouter.get('/:id', getLocation);

    // locationRouter.post('/', createLocation);
    // route
    // locationRouter.delete('/:id', hasPermission('admin'), removeLocation);
    locationRouter.post(
        "/",
        hasModulePermission("location", "add_location"),
        createLocation
    );

    locationRouter.put(
        "/:id",
        hasModulePermission("location", "edit_location"),
        updateLocation
    );

    locationRouter.delete(
        "/:id",
        hasModulePermission("location", "delete_location"),
        removeLocation
    );


    locationRouter.post('/child-assets', getChildAssetsAgainstLocation);
    locationRouter.put('/floor-map-image/:id', updateLocationFloorMapImage);
    // locationRouter.put('/:id', updateLocation);




    router.use('/locations', locationRouter);
}