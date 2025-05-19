import express from 'express';
import floorMapRoutes from './floorMap/floorMap.routes';
const router = express.Router();

export default (): express.Router => {
    floorMapRoutes(router);
    return router;
}