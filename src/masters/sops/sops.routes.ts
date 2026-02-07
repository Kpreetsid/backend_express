import express from 'express';
import { sopsController } from './sops.controller';
import { validateParamId } from '../../middlewares/validate';

export default (router: express.Router) => {
    const sopRouter = express.Router();
    sopRouter.get('/', sopsController.getAll);
    sopRouter.get('/:id', validateParamId, sopsController.getSop);
    sopRouter.post('/', sopsController.create);
    sopRouter.put('/:id', validateParamId, sopsController.update);
    sopRouter.patch('/:id', validateParamId, sopsController.update);
    sopRouter.delete('/:id', validateParamId, sopsController.remove);
    router.use('/sops', sopRouter);
}