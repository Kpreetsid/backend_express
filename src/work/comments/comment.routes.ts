import { Router } from 'express';
import { getAll, getDataById, create, update, remove } from './comment.controller';

export default (router: Router) => {
    router.get('/', getAll);
    router.get('/:commentId', getDataById);
    router.post('/', create);
    router.put('/:commentId', update);
    router.delete('/:commentId', remove);
    return router;
};
