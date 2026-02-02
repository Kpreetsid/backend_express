import express from 'express';
import { sopsController } from './sops.controller';

export default (router: express.Router) => {
    const sopRouter = express.Router();
    sopRouter.get('/', sopsController.getAll);
    sopRouter.get('/:id', sopsController.getSop);
    sopRouter.post('/', sopsController.create);
    sopRouter.put('/:id', sopsController.update);
    sopRouter.patch('/:id', sopsController.update);
    sopRouter.delete('/:id', sopsController.remove);
    router.use('/sops', sopRouter);
}