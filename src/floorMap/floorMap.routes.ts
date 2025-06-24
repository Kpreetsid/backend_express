import express from 'express';
import { getFloorMaps, getFloorMap, createFloorMap, updateFloorMap, removeFloorMap, getFloorMapCoordinates, getFloorMapAssetCoordinates, setFloorMapCoordinates } from './floorMap.controller';
import { hasPermission } from '../middlewares';

export default (router: express.Router) => {
    const floorMapRouter = express.Router();
    floorMapRouter.get('/', getFloorMaps);
    floorMapRouter.get('/coordinate', getFloorMapCoordinates);
    floorMapRouter.post('/coordinate', setFloorMapCoordinates);
    floorMapRouter.get('/coordinate/asset/:id', getFloorMapAssetCoordinates);
    floorMapRouter.get('/:id', getFloorMap);
    floorMapRouter.post('/', createFloorMap);
    floorMapRouter.put('/:id', updateFloorMap);
    floorMapRouter.delete('/:id', hasPermission('admin'), removeFloorMap);
    router.use('/floor-map', floorMapRouter);
}