import express from 'express';
import { commentController } from './comments.controller';
import { validateParam, validateParamId } from '../../../middlewares/validate';
import { commentValidator } from './comments.validator';
import { validate } from '../../../middlewares/validator.middleware';
import { hasRolePermission } from '../../../middlewares/permission';

export default (router: express.Router) => {
    router.use(validateParam("postId"));
    router.get('/', hasRolePermission('posts', 'view'), commentController.getAllComments.bind(commentController));
    router.get('/:id', validateParamId, hasRolePermission('posts', 'view'), commentController.getCommentById.bind(commentController));
    router.post('/', hasRolePermission('posts', 'view'), commentValidator, validate, commentController.createComment.bind(commentController));
    router.put('/:id', validateParamId, hasRolePermission('posts', 'view'), commentValidator, validate, commentController.updateComment.bind(commentController));
    router.delete('/:id', validateParamId, hasRolePermission('posts', 'view'), commentController.removeComment.bind(commentController));
    return router;
}
