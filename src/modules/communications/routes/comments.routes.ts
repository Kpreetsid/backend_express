import express from 'express';
import { commentController } from '../controllers/comments.controller';
import { validateParam, validateParamId } from '../../../common/middlewares/validate.middleware';
import { commentValidator } from '../validators/comments.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

export default (router: express.Router) => {
    router.use(validateParam("postId"));
    router.get('/', commentController.getAllComments);
    router.get('/:id', validateParamId, commentController.getCommentById);
    router.post('/', commentValidator, validate, commentController.createComment);
    router.put('/:id', validateParamId, commentValidator, validate, commentController.updateComment);
    router.delete('/:id', validateParamId, commentController.removeComment);
    return router;
}