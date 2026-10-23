import express from 'express';
import { postController } from '../controllers/posts.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import commentsRoutes from './comments.routes';
import { postValidator } from '../validators/post.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

export default (router: express.Router) => {
    const postRouter = express.Router();
    postRouter.get('/', postController.getPosts);
    postRouter.get('/:id', validateParamId, postController.getPost);
    postRouter.post('/', postValidator, validate, postController.createPost);
    postRouter.put('/:id', validateParamId, postValidator, validate, postController.updatePost);
    postRouter.patch('/:id', validateParamId, postValidator, validate, postController.partialUpdatePost);
    postRouter.delete('/:id', validateParamId, postController.removePost);
    postRouter.put('/:id/like', validateParamId, postController.likePost);
    postRouter.put('/:id/dislike', validateParamId, postController.dislikePost);
    const commentRouter = express.Router({ mergeParams: true });
    postRouter.use("/:postId/comments", commentsRoutes(commentRouter));
    router.use('/posts', postRouter);
}

