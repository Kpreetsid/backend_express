import express from 'express';
import { locationReportController } from './location.controller';
import { hasRolePermission } from '../../middlewares';
import { validateParamId } from '../../middlewares/validate';

export default (router: express.Router) => {
    const locationReportRouter = express.Router();
    locationReportRouter.get('/', locationReportController.getLocationsReport);
    locationReportRouter.post('/', hasRolePermission('location', 'create_report'), locationReportController.createReport);
    locationReportRouter.put('/:id', validateParamId, hasRolePermission('location', 'create_report'), locationReportController.updateReport);
    locationReportRouter.patch('/:id', validateParamId, hasRolePermission('location', 'create_report'), locationReportController.updateReport);
    locationReportRouter.delete('/:id', validateParamId, hasRolePermission('location', 'delete_report'), locationReportController.deleteReport);
    router.use('/locations', locationReportRouter);
}

