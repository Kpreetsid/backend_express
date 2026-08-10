import express from 'express';
import { locationController } from './location.controller';
import { hasAccountFeature, hasRolePermission } from '../../middlewares';
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
  locationRouter.get('/make-copy/:id', hasAccountFeature('child_location', 'add'), validateParamId, locationController.createDuplicateLocation);
  locationRouter.get('/:id', validateParamId, locationController.getLocation);
  locationRouter.post('/', hasAccountFeature('location', 'add'), hasRolePermission('location', 'add_location'), locationValidator, validate, locationController.createLocation);
  locationRouter.post('/child-assets', locationController.getChildAssetsAgainstLocation);
  locationRouter.put('/floor-map-image/:id', hasAccountFeature('location_floor_map', 'edit'), validateParamId, locationController.updateLocationFloorMapImage);
  locationRouter.put('/:id', hasAccountFeature('location', 'edit'), validateParamId, hasRolePermission('location', 'edit_location'), locationValidator, validate, locationController.updateLocation);
  locationRouter.patch('/:id', hasAccountFeature('location', 'edit'), validateParamId, hasRolePermission('location', 'edit_location'), locationValidator, validate, locationController.updateLocation);
  locationRouter.delete('/:id', hasAccountFeature('location', 'delete'), validateParamId, hasRolePermission('location', 'delete_location'), locationController.removeLocation);
  router.use('/locations', locationRouter);
};
