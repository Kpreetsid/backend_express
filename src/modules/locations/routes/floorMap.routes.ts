import express from 'express';
import { floorMapController } from '../controllers/floorMap.controller';
import { hasRolePermission } from '../../../common/middlewares/index';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { floorMapValidator } from '../validators/floorMap.validator';
import { validate } from '../../../common/middlewares/validate.middleware';

export default (router: express.Router) => {
    const floorMapRouter = express.Router();
    floorMapRouter.get('/', hasRolePermission('floorMap', 'view_floor_map'), floorMapController.getAllFloorMaps);
    floorMapRouter.get('/coordinate', hasRolePermission('floorMap', 'view_floor_map'), floorMapController.getFloorMapCoordinates);
    floorMapRouter.post('/coordinate', hasRolePermission('floorMap', 'create_kpi'), floorMapValidator, validate, floorMapController.setFloorMapCoordinates);
    floorMapRouter.delete('/coordinate/:id', validateParamId, hasRolePermission('floorMap', 'delete_kpi'), floorMapController.removeFloorMapCoordinates);
    floorMapRouter.get('/coordinate/asset/:id', validateParamId, hasRolePermission('floorMap', 'view_floor_map'), floorMapController.getFloorMapAssetCoordinates);
    floorMapRouter.get('/:id', validateParamId, hasRolePermission('floorMap', 'view_floor_map'), floorMapController.getFloorMapByID);
    floorMapRouter.post('/', hasRolePermission('floorMap', 'create_kpi'), floorMapValidator, validate, floorMapController.createFloorMap);
    floorMapRouter.put('/:id', validateParamId, hasRolePermission('floorMap', 'upload_floor_map'), floorMapValidator, validate, floorMapController.updateFloorMap);
    floorMapRouter.patch('/:id', validateParamId, hasRolePermission('floorMap', 'upload_floor_map'), floorMapValidator, validate, floorMapController.updateFloorMap);
    floorMapRouter.delete('/:id', validateParamId, hasRolePermission('floorMap', 'delete_kpi'), floorMapController.removeFloorMap);
    router.use('/floor-map', floorMapRouter);
}
