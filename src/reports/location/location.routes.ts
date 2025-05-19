import express from 'express';
import { getLocationsReport } from './location.controller';

export default (router: express.Router) => {
    router.get('/locations', getLocationsReport);
}