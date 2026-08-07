import express from 'express';
import { commentController } from './comments.controller';
import { validateParam, validateParamId } from '../../../middlewares/validate';
import { commentValidator } from './comments.validator';
import { validate } from '../../../middlewares/validator.middleware';
import { hasRolePermission } from '../../../middlewares';

export default (router: express.Router) => {
    router.use(validateParam("postId"));
    router.get('/', commentController.getAllComments);
    router.get('/:id', validateParamId, commentController.getCommentById);
    router.post('/', hasRolePermission('posts', 'add'), commentValidator, validate, commentController.createComment);
    router.put('/:id', validateParamId, hasRolePermission('posts', 'edit'), commentValidator, validate, commentController.updateComment);
    router.delete('/:id', validateParamId, hasRolePermission('posts', 'delete'), commentController.removeComment);
    return router;
}
