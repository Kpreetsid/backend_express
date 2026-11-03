import express from 'express';
import { hasRolePermission } from '@common/middlewares/permission.middleware';
import { commentController } from '@modules/communications/controllers/comments.controller';
import { validateParam, validateParamId } from '@common/middlewares/validate.middleware';
import { commentValidator } from '@modules/communications/validators/comments.validator';
import { validate } from '@common/middlewares/validator.middleware';

export default (router: express.Router) => {
    router.use(validateParam("postId"));
    router.use(hasRolePermission('posts', 'view'));
    router.get('/', commentController.getAllComments.bind(commentController));
    router.get('/:id', validateParamId, commentController.getCommentById.bind(commentController));
    router.post('/', hasRolePermission('posts', 'add'), commentValidator, validate, commentController.createComment.bind(commentController));
    router.put('/:id', validateParamId, hasRolePermission('posts', 'edit'), commentValidator, validate, commentController.updateComment.bind(commentController));
    router.delete('/:id', validateParamId, hasRolePermission('posts', 'delete'), commentController.removeComment.bind(commentController));
    return router;
}
