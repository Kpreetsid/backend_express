import express from 'express';
import { floorMapController } from './floorMap.controller';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const floorMapRouter = express.Router();
    floorMapRouter.get('/', hasRolePermission('floorMap', 'view_floor_map'), floorMapController.getAllFloorMaps);
    floorMapRouter.get('/coordinate', hasRolePermission('floorMap', 'view_floor_map'), floorMapController.getFloorMapCoordinates);
    floorMapRouter.post('/coordinate', floorMapController.setFloorMapCoordinates);
    floorMapRouter.delete('/coordinate/:id', hasRolePermission('floorMap', 'delete_kpi'), floorMapController.removeFloorMapCoordinates);
    floorMapRouter.get('/coordinate/asset/:id', floorMapController.getFloorMapAssetCoordinates);
    floorMapRouter.get('/:id', floorMapController.getFloorMapByID);
    floorMapRouter.post('/', hasRolePermission('floorMap', 'create_kpi'), floorMapController.createFloorMap);
    floorMapRouter.put('/:id', hasRolePermission('floorMap', 'upload_floor_map'), floorMapController.updateFloorMap);
    floorMapRouter.delete('/:id', hasRolePermission('floorMap', 'delete_kpi'), floorMapController.removeFloorMap);
    router.use('/floor-map', floorMapRouter);
}