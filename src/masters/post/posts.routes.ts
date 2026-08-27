import express from 'express';
import { postController } from './posts.controller';
import { validateParamId } from '../../middlewares/validate';
import commentsRoutes from './comments/comments.routes';
<<<<<<< Updated upstream
import { postValidator } from './post.validator';
import { validate } from '../../middlewares/validator.middleware';

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
=======
import { postPatchValidator, postValidator } from './post.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasRolePermission } from '../../middlewares/permission';

export default (router: express.Router) => {
    const postRouter = express.Router();
    postRouter.get('/', hasRolePermission('posts', 'view'), postController.getPosts.bind(postController));
    postRouter.get('/:id', validateParamId, hasRolePermission('posts', 'view'), postController.getPost.bind(postController));
    postRouter.post('/', hasRolePermission('posts', 'add'), postValidator, validate, postController.createPost.bind(postController));
    postRouter.put('/:id', validateParamId, hasRolePermission('posts', 'edit'), postValidator, validate, postController.updatePost.bind(postController));
    postRouter.patch('/:id', validateParamId, hasRolePermission('posts', 'edit'), postPatchValidator, validate, postController.partialUpdatePost.bind(postController));
    postRouter.delete('/:id', validateParamId, hasRolePermission('posts', 'delete'), postController.removePost.bind(postController));
    postRouter.put('/:id/like', validateParamId, hasRolePermission('posts', 'view'), postController.likePost.bind(postController));
    postRouter.put('/:id/dislike', validateParamId, hasRolePermission('posts', 'view'), postController.dislikePost.bind(postController));

>>>>>>> Stashed changes
    const commentRouter = express.Router({ mergeParams: true });
    postRouter.use("/:postId/comments", commentsRoutes(commentRouter));
    router.use('/posts', postRouter);
}
<<<<<<< Updated upstream

=======
>>>>>>> Stashed changes
