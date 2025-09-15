import { Router } from 'express';
import { getAll, getDataById, create, update, remove } from './comment.controller';
import { hasPermission } from '../../middlewares';

export default (router: Router) => {
    router.get('/', getAll);
    router.get('/:commentId', getDataById);
    router.post('/', create);
    router.put('/:commentId', update);
    router.delete('/:commentId', hasPermission('admin'), remove);
    return router;
};
