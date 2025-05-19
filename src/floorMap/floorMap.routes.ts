import express from 'express';
import { getFloorMaps, getFloorMap, createFloorMap, updateFloorMap, removeFloorMap } from './floorMap.controller';

export default (router: express.Router) => {
    router.get('/floorMaps', getFloorMaps);
    router.get('/floorMap/:id', getFloorMap);
    router.post('/floorMap', createFloorMap);
    router.put('/floorMap/:id', updateFloorMap);
    router.delete('/floorMap/:id', removeFloorMap);
}