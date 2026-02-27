import express from 'express';
import { commentController } from './comments.controller';
import { validateParam, validateParamId } from '../../../middlewares/validate';

export default (router: express.Router) => {
    router.use(validateParam("postId"));
    router.get('/', commentController.getAllComments);
    router.get('/:id', validateParamId, commentController.getCommentById);
    router.post('/', commentController.createComment);
    router.put('/:id', validateParamId, commentController.updateComment);
    router.delete('/:id', validateParamId, commentController.removeComment);
    return router;
}