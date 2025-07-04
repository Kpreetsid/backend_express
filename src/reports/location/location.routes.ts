import express from 'express';
import { getLocationsReport, createReport, deleteReport } from './location.controller';

export default (router: express.Router) => {
    const locationReportRouter = express.Router();
    locationReportRouter.get('/', getLocationsReport);
    locationReportRouter.post('/', createReport);
    locationReportRouter.delete('/:id', deleteReport);
    router.use('/locations', locationReportRouter);
}