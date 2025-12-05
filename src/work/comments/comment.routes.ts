import { Router } from 'express';
import { commentController } from './comment.controller';
import { validateId, validateBody } from '../../middlewares/validate';
import { createCommentSchema, updateCommentSchema } from '../../models/comment.model';

export default (router: Router) => {
  router.get("/", commentController.getAll);
  router.get("/:commentId", validateId, commentController.getDataById);
  router.post("/", validateBody(createCommentSchema), commentController.create);
  router.put("/:commentId", validateId, validateBody(updateCommentSchema), commentController.update);
  router.delete("/:commentId", validateId, commentController.remove);
  return router;
};