import express from 'express';
import assetRoutes from './asset/asset.routes';
import locationRoutes from './location/location.routes';
const router = express.Router();

export default (): express.Router => {
    assetRoutes(router);
    locationRoutes(router);
    return router;
}