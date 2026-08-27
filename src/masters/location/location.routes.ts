import express from 'express';
import { locationController } from './location.controller';
import { hasAnyRolePermission, hasRolePermission } from '../../middlewares';
import { validateParamId } from '../../middlewares/validate';
import { locationValidator } from './location.validator';
import { validate } from '../../middlewares/validator.middleware';


export default (router: express.Router) => {
  const locationRouter = express.Router();
  const requireLocationCreatePermission = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const action = req.body?.parent_id ? 'add_child_location' : 'add_location';
    hasRolePermission('location', action)(req, res, next);
  };
  locationRouter.get('/', locationController.getLocations);
  locationRouter.get('/tree', locationController.getLocationTree);
  locationRouter.get('/sensor-list', hasRolePermission('gateways', 'view'), locationController.getLocationSensorList);
  locationRouter.get('/kpi-filter', locationController.getKpiFilterLocations);
  locationRouter.get('/child/:id', validateParamId, locationController.getChildLocation);
  locationRouter.get('/make-copy/:id', validateParamId,
    hasAnyRolePermission('location', ['add_location', 'add_child_location']), locationController.createDuplicateLocation);
  locationRouter.get('/:id', validateParamId, locationController.getLocation);
  locationRouter.post('/', requireLocationCreatePermission, locationValidator, validate, locationController.createLocation);
  locationRouter.post('/child-assets', locationController.getChildAssetsAgainstLocation);
  locationRouter.put('/floor-map-image/:id', validateParamId,
    hasRolePermission('floorMap', 'upload_floor_map'), locationController.updateLocationFloorMapImage);
  locationRouter.put('/:id', validateParamId, hasRolePermission('location', 'edit_location'), locationValidator, validate, locationController.updateLocation);
  locationRouter.patch('/:id', validateParamId, hasRolePermission('location', 'edit_location'), locationValidator, validate, locationController.updateLocation);
  locationRouter.delete('/:id', validateParamId, hasRolePermission('location', 'delete_location'), locationController.removeLocation);
  router.use('/locations', locationRouter);
};
