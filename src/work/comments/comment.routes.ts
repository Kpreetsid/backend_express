import express from 'express';
import { getComments, getComment, getFilterComments, createComment, updateComment, removeComment } from './comment.controller';

export default (router: express.Router) => {
    const commentRouter = express.Router();
    commentRouter.get('/', getComments);
    commentRouter.get('/filter', getFilterComments);
    commentRouter.get('/:id', getComment);
    commentRouter.post('/', createComment);
    commentRouter.put('/:id', updateComment);
    commentRouter.delete('/:id', removeComment);
    router.use('/comments', commentRouter);
}