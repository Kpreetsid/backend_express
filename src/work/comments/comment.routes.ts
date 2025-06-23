import express from 'express';
import { getComments, getComment, createComment, updateComment, removeComment } from './comment.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const commentRouter = express.Router();
    commentRouter.get('/', getComments);
    commentRouter.get('/:id', getComment);
    commentRouter.post('/', createComment);
    commentRouter.put('/:id', updateComment);
    commentRouter.delete('/:id', hasPermission('admin'),removeComment);
    router.use('/comments', commentRouter);
}