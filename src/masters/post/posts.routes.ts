import express from 'express';
import { getPosts, getPost, createPost, updatePost, removePost } from './posts.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const postRouter = express.Router();
    postRouter.get('/', getPosts);
    postRouter.get('/:id', getPost);
    postRouter.post('/', createPost);
    postRouter.put('/:id', updatePost);
    postRouter.delete('/:id', hasPermission('admin'),removePost);
    router.use('/posts', postRouter);
}