import express from 'express';
import { commentController } from './comments.controller';
import { validateParam, validateParamId } from '../../../middlewares/validate';
import { commentValidator } from './comments.validator';
import { validate } from '../../../middlewares/validator.middleware';

export default (router: express.Router) => {
    router.use(validateParam("postId"));
    router.get('/', commentController.getAllComments);
    router.get('/:id', validateParamId, commentController.getCommentById);
    router.post('/', commentValidator, validate, commentController.createComment);
    router.put('/:id', validateParamId, commentValidator, validate, commentController.updateComment);
    router.delete('/:id', validateParamId, commentController.removeComment);
    return router;
}