import express from 'express';
import { observationController } from '../controllers/observation.controller';
import { hasRolePermission } from '../../../common/middlewares/index';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { observationCreateValidator, observationUpdateValidator } from '../validators/observation.validator';
import { validate } from '../../../common/middlewares/validate.middleware';

export default (router: express.Router) => {
    const observationRouter = express.Router();
    observationRouter.get('/', observationController.getObservations);
    observationRouter.get('/:id', validateParamId, observationController.getObservation);
    observationRouter.post('/', hasRolePermission('asset', 'add_observation'), observationCreateValidator, validate, observationController.createObservation);
    observationRouter.put('/:id', hasRolePermission('asset', 'add_observation'), validateParamId, observationUpdateValidator, validate, observationController.updateObservation);
    observationRouter.patch('/:id', hasRolePermission('asset', 'add_observation'), validateParamId, observationUpdateValidator, validate, observationController.updateObservation);
    observationRouter.delete('/:id', hasRolePermission('asset', 'add_observation'), validateParamId, observationController.removeObservation);
    router.use('/observations', observationRouter);
}

