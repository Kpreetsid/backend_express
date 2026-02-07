import { Router } from 'express';
import { commentController } from './comment.controller';
import { validateParamId } from '../../middlewares/validate';

export default (router: Router) => {
  router.get("/", commentController.getAll);
  router.get("/:commentId", validateParamId, commentController.getDataById);
  router.post("/", commentController.create);
  router.put("/:commentId", validateParamId, commentController.update);
  router.patch("/:commentId", validateParamId, commentController.update);
  router.delete("/:commentId", validateParamId, commentController.remove);
  return router;
};