import express from 'express';
import { locationController } from './location.controller';
import { hasRolePermission } from '../../middlewares';
import { validateParamId } from '../../middlewares/validate';


export default (router: express.Router) => {
  const locationRouter = express.Router();
  locationRouter.get('/', locationController.getLocations);
  locationRouter.get('/tree', locationController.getLocationTree);
  locationRouter.get('/sensor-list', locationController.getLocationSensorList);
  locationRouter.get('/kpi-filter', locationController.getKpiFilterLocations);
  locationRouter.get('/child/:id', locationController.getChildLocation);
  locationRouter.get('/make-copy/:id', locationController.createDuplicateLocation);
  locationRouter.get('/:id', validateParamId, locationController.getLocation);
  locationRouter.post('/', hasRolePermission('location', 'add_location'), locationController.createLocation);
  locationRouter.post('/child-assets', locationController.getChildAssetsAgainstLocation);
  locationRouter.put('/floor-map-image/:id', locationController.updateLocationFloorMapImage);
  locationRouter.put('/:id', validateParamId, hasRolePermission('location', 'edit_location'), locationController.updateLocation);
  locationRouter.patch('/:id', validateParamId, hasRolePermission('location', 'edit_location'), locationController.updateLocation);
  locationRouter.delete('/:id', validateParamId, hasRolePermission('location', 'delete_location'), locationController.removeLocation);
  router.use('/locations', locationRouter);
};