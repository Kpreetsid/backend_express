import { Router } from 'express';
import { getAll, getDataById, create, update, remove } from './comment.controller';
import { validateId, validateBody } from '../../middlewares/validate';
import { createCommentSchema, updateCommentSchema } from '../../models/comment.model';

export default (router: Router) => {
  router.get("/", getAll);
  router.get("/:commentId", validateId, getDataById);
  router.post("/", validateBody(createCommentSchema), create);
  router.put("/:commentId", validateId, validateBody(updateCommentSchema), update);
  router.delete("/:commentId", validateId, remove);
  return router;
};