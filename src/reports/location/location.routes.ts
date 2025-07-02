import express from 'express';
import { getLocationsReport, createReport } from './location.controller';

export default (router: express.Router) => {
    const locationReportRouter = express.Router();
    locationReportRouter.get('/', getLocationsReport);
    locationReportRouter.post('/', createReport);
    router.use('/locations', locationReportRouter);
}