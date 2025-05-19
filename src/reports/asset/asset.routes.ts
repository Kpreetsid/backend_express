import express from 'express';
import { getAssetsReport } from './asset.controller';

export default (router: express.Router) => {
    router.get('/assets', getAssetsReport);
}