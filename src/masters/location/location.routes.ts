import express from 'express';
import { locationController } from './location.controller';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
  const locationRouter = express.Router();
  locationRouter.get('/', locationController.getLocations);
  locationRouter.get('/tree', locationController.getLocationTree);
  locationRouter.get('/sensor-list', locationController.getLocationSensorList);
  locationRouter.get('/kpi-filter', locationController.getKpiFilterLocations);
  locationRouter.get('/child/:id', locationController.getChildLocation);
  locationRouter.get('/make-copy/:id', locationController.createDuplicateLocation);
  locationRouter.get('/:id', locationController.getLocation);
  locationRouter.post('/', hasRolePermission('location', 'add_location'), locationController.createLocation);
  locationRouter.post('/child-assets', locationController.getChildAssetsAgainstLocation);
  locationRouter.put('/floor-map-image/:id', locationController.updateLocationFloorMapImage);
  locationRouter.put('/:id', hasRolePermission('location', 'edit_location'), locationController.updateLocation);
  locationRouter.patch('/:id', hasRolePermission('location', 'edit_location'), locationController.updateLocation);
  locationRouter.delete('/:id', hasRolePermission('location', 'delete_location'), locationController.removeLocation);
  router.use('/locations', locationRouter);
};