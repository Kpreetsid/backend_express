import express from 'express';
import { postController } from './posts.controller';
import { validateParamId } from '../../middlewares/validate';
import commentsRoutes from './comments/comments.routes';

export default (router: express.Router) => {
    const postRouter = express.Router();
    postRouter.get('/', postController.getPosts);
    postRouter.get('/:id', validateParamId, postController.getPost);
    postRouter.post('/', postController.createPost);
    postRouter.put('/:id', validateParamId, postController.updatePost);
    postRouter.patch('/:id', validateParamId, postController.partialUpdatePost);
    postRouter.delete('/:id', validateParamId, postController.removePost);
    postRouter.put('/:id/like', validateParamId, postController.likePost);
    postRouter.put('/:id/dislike', validateParamId, postController.dislikePost);
    
    const commentRouter = express.Router({ mergeParams: true });
    commentRouter.use("/:id/comments", commentsRoutes(commentRouter));
    postRouter.use('/', commentRouter);
    router.use('/posts', postRouter);
}