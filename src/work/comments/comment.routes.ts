import express from 'express';
import { getAll, getDataById, create, update, remove } from './comment.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const commentRouter = express.Router();
    commentRouter.get('/', getAll);
    commentRouter.get('/:id', getDataById);
    commentRouter.post('/', create);
    commentRouter.put('/:id', update);
    commentRouter.delete('/:id', hasPermission('admin'), remove);
    router.use('/comments', commentRouter);
}