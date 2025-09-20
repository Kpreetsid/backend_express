import express from 'express';
import { getAllFloorMaps, getFloorMapByID, createFloorMap, updateFloorMap, removeFloorMap, removeFloorMapCoordinates, getFloorMapCoordinates, getFloorMapAssetCoordinates, setFloorMapCoordinates } from './floorMap.controller';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const floorMapRouter = express.Router();
    floorMapRouter.get('/', hasRolePermission('floorMap', 'view_floor_map'), getAllFloorMaps);
    floorMapRouter.get('/coordinate', hasRolePermission('floorMap', 'view_floor_map'), getFloorMapCoordinates);
    floorMapRouter.post('/coordinate', setFloorMapCoordinates);
    floorMapRouter.delete('/coordinate/:id', hasRolePermission('floorMap', 'delete_floor_map'), removeFloorMapCoordinates);
    floorMapRouter.get('/coordinate/asset/:id', getFloorMapAssetCoordinates);
    floorMapRouter.get('/:id', getFloorMapByID);
    floorMapRouter.post('/', hasRolePermission('floorMap', 'create_kpi'), createFloorMap);
    floorMapRouter.put('/:id', hasRolePermission('floorMap', 'upload_floor_map'), updateFloorMap);
    floorMapRouter.delete('/:id', hasRolePermission('floorMap', 'delete_floor_map'), removeFloorMap);
    router.use('/floor-map', floorMapRouter);
}