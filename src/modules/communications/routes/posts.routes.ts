import express from 'express';
import { postController } from '../controllers/posts.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import commentsRoutes from './comments.routes';

import { postPatchValidator, postValidator } from '../validators/post.validator';
import { validate } from '../../../common/middlewares/validate.middleware';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';

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


    const commentRouter = express.Router({ mergeParams: true });
    postRouter.use("/:postId/comments", commentsRoutes(commentRouter));
    router.use('/posts', postRouter);
}

