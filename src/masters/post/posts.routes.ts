import express from 'express';
import { getPosts, getPost, getFilterPost, createPost, updatePost, removePost } from './posts.controller';
import { hasPermission } from '../../_config/permission';

export default (router: express.Router) => {
    const postRouter = express.Router();
    postRouter.get('/', getPosts);
    postRouter.get('/filter', getFilterPost);
    postRouter.get('/:id', getPost);
    postRouter.post('/', createPost);
    postRouter.put('/:id', updatePost);
    postRouter.delete('/:id', hasPermission('admin'),removePost);
    router.use('/posts', postRouter);
}