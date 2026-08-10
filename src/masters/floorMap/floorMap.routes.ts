import express from 'express';
import { floorMapController } from './floorMap.controller';
import { hasRolePermission } from '../../middlewares';
import { hasAnyAccountFeature } from '../../middlewares/permission';
import { validateParamId } from '../../middlewares/validate';
import { floorMapValidator } from './floorMap.validator';
import { validate } from '../../middlewares/validator.middleware';

export default (router: express.Router) => {
    const floorMapRouter = express.Router();
    floorMapRouter.get('/', hasRolePermission('floorMap', 'view_floor_map'), floorMapController.getAllFloorMaps);
    floorMapRouter.get('/coordinate', hasRolePermission('floorMap', 'view_floor_map'), floorMapController.getFloorMapCoordinates);
    floorMapRouter.post('/coordinate', hasAnyAccountFeature(['floor_map', 'location_floor_map'], 'add'), floorMapValidator, validate, floorMapController.setFloorMapCoordinates);
    floorMapRouter.delete('/coordinate/:id', hasAnyAccountFeature(['floor_map', 'location_floor_map'], 'delete'), validateParamId, hasRolePermission('floorMap', 'delete_kpi'), floorMapController.removeFloorMapCoordinates);
    floorMapRouter.get('/coordinate/asset/:id', validateParamId, floorMapController.getFloorMapAssetCoordinates);
    floorMapRouter.get('/:id', validateParamId, floorMapController.getFloorMapByID);
    floorMapRouter.post('/', hasAnyAccountFeature(['floor_map', 'location_floor_map'], 'add'), hasRolePermission('floorMap', 'create_kpi'), floorMapValidator, validate, floorMapController.createFloorMap);
    floorMapRouter.put('/:id', hasAnyAccountFeature(['floor_map', 'location_floor_map'], 'edit'), validateParamId, hasRolePermission('floorMap', 'upload_floor_map'), floorMapValidator, validate, floorMapController.updateFloorMap);
    floorMapRouter.patch('/:id', hasAnyAccountFeature(['floor_map', 'location_floor_map'], 'edit'), validateParamId, hasRolePermission('floorMap', 'upload_floor_map'), floorMapValidator, validate, floorMapController.updateFloorMap);
    floorMapRouter.delete('/:id', hasAnyAccountFeature(['floor_map', 'location_floor_map'], 'delete'), validateParamId, hasRolePermission('floorMap', 'delete_kpi'), floorMapController.removeFloorMap);
    router.use('/floor-map', floorMapRouter);
}
