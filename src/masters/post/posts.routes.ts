import express from 'express';
import { postController } from './posts.controller';

export default (router: express.Router) => {
    const postRouter = express.Router();
    postRouter.get('/', postController.getPosts);
    postRouter.get('/:id', postController.getPost);
    postRouter.post('/', postController.createPost);
    postRouter.put('/:id', postController.updatePost);
    postRouter.delete('/:id', postController.removePost);
    router.use('/posts', postRouter);
}