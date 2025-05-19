import express from 'express';
import { getUserLocations } from './userLocation.controller';

export default (router: express.Router) => {
    router.get('/userToLocations', getUserLocations);
}