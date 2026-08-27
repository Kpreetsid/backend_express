import express from 'express';
import { locationController } from './location.controller';
import { hasRolePermission } from '../../middlewares';
import { validateParamId } from '../../middlewares/validate';
import { locationValidator } from './location.validator';
import { validate } from '../../middlewares/validator.middleware';


export default (router: express.Router) => {
  const locationRouter = express.Router();
  locationRouter.get('/', locationController.getLocations);
  locationRouter.get('/tree', locationController.getLocationTree);
  locationRouter.get('/sensor-list', locationController.getLocationSensorList);
  locationRouter.get('/kpi-filter', locationController.getKpiFilterLocations);
  locationRouter.get('/child/:id', validateParamId, locationController.getChildLocation);
  locationRouter.get('/make-copy/:id', validateParamId, locationController.createDuplicateLocation);
  locationRouter.get('/:id', validateParamId, locationController.getLocation);
  locationRouter.post('/', hasRolePermission('location', 'add_location'), locationValidator, validate, locationController.createLocation);
  locationRouter.post('/child-assets', locationController.getChildAssetsAgainstLocation);
  locationRouter.put('/floor-map-image/:id', validateParamId, locationController.updateLocationFloorMapImage);
  locationRouter.put('/:id', validateParamId, hasRolePermission('location', 'edit_location'), locationValidator, validate, locationController.updateLocation);
  locationRouter.patch('/:id', validateParamId, hasRolePermission('location', 'edit_location'), locationValidator, validate, locationController.updateLocation);
  locationRouter.delete('/:id', validateParamId, hasRolePermission('location', 'delete_location'), locationController.removeLocation);
  router.use('/locations', locationRouter);
};
