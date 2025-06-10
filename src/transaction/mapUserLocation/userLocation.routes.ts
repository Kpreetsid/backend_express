import express from 'express';
import { getUserLocations, getUserAssets } from './userLocation.controller';

export default (router: express.Router) => {
    router.get('/userToLocations', getUserLocations);
    router.get('/userToAssets', getUserAssets);
}