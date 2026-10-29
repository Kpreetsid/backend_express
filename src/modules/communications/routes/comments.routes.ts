import express from 'express';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';
import { commentController } from '../controllers/comments.controller';
import { validateParam, validateParamId } from '../../../common/middlewares/validate.middleware';
import { commentValidator } from '../validators/comments.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

export default (router: express.Router) => {
    router.use(validateParam("postId"));
    router.use(hasRolePermission('posts', 'view'));
    router.get('/', commentController.getAllComments);
    router.get('/:id', validateParamId, commentController.getCommentById);
    router.post('/', hasRolePermission('posts', 'add'), commentValidator, validate, commentController.createComment);
    router.put('/:id', validateParamId, hasRolePermission('posts', 'edit'), commentValidator, validate, commentController.updateComment);
    router.delete('/:id', validateParamId, hasRolePermission('posts', 'delete'), commentController.removeComment);
    return router;
}