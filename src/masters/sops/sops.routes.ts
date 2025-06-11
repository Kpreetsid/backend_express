import express from 'express';
import { getSops, getSop, createSop, updateSop, removeSop } from './sops.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const sopRouter = express.Router();
    sopRouter.get('/', getSops);
    sopRouter.get('/:id', getSop);
    sopRouter.post('/', createSop);
    sopRouter.put('/:id', updateSop);
    sopRouter.delete('/:id', hasPermission('admin'),removeSop);
    router.use('/sops', sopRouter);
}