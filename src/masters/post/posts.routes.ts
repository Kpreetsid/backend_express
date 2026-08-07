import express from 'express';
import { postController } from './posts.controller';
import { validateParamId } from '../../middlewares/validate';
import commentsRoutes from './comments/comments.routes';
import { postValidator } from './post.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const postRouter = express.Router();
    postRouter.get('/', postController.getPosts);
    postRouter.get('/:id', validateParamId, postController.getPost);
    postRouter.post('/', hasRolePermission('posts', 'add'), postValidator, validate, postController.createPost);
    postRouter.put('/:id', validateParamId, hasRolePermission('posts', 'edit'), postValidator, validate, postController.updatePost);
    postRouter.patch('/:id', validateParamId, hasRolePermission('posts', 'edit'), postValidator, validate, postController.partialUpdatePost);
    postRouter.delete('/:id', validateParamId, hasRolePermission('posts', 'delete'), postController.removePost);
    postRouter.put('/:id/like', validateParamId, postController.likePost);
    postRouter.put('/:id/dislike', validateParamId, postController.dislikePost);

    const commentRouter = express.Router({ mergeParams: true });
    postRouter.use("/:postId/comments", commentsRoutes(commentRouter));
    router.use('/posts', postRouter);
}
