import express from 'express';
import { locationReportController } from '../controllers/location.controller';
import { hasRolePermission } from '../../../common/middlewares/index';
import { validateParamId } from '../../../common/middlewares/validate.middleware';

export default (router: express.Router) => {
    const locationReportRouter = express.Router();
    locationReportRouter.get('/', locationReportController.getLocationsReport);
    locationReportRouter.post('/', hasRolePermission('location', 'create_report'), locationReportController.createReport);
    locationReportRouter.put('/:id', validateParamId, hasRolePermission('location', 'create_report'), locationReportController.updateReport);
    locationReportRouter.patch('/:id', validateParamId, hasRolePermission('location', 'create_report'), locationReportController.updateReport);
    locationReportRouter.delete('/:id', validateParamId, hasRolePermission('location', 'delete_report'), locationReportController.deleteReport);
    router.use('/locations', locationReportRouter);
}

