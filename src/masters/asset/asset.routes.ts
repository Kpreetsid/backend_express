import express from 'express';
import { authenticateJwt } from '../../_config/auth';
import { getAssets, getAsset, createAsset, updateAsset, removeAsset } from './asset.controller';

export default (router: express.Router) => {
    router.get('/assets', getAssets);
    router.get('/assets/:id', getAsset);
    router.post('/assets', createAsset);
    router.put('/assets/:id', updateAsset);
    router.delete('/assets/:id', removeAsset);
}