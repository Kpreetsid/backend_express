import { Router } from 'express';
import { commentController } from './comment.controller';
import { validateParam, validateParamId } from '../../middlewares/validate';

export default (router: Router) => {
  router.use(validateParamId); // Validate inherited order id
  router.get("/", commentController.getAll);
  router.get("/:commentId", validateParam("commentId"), commentController.getDataById);
  router.post("/", commentController.create);
  router.put("/:commentId", validateParam("commentId"), commentController.update);
  router.patch("/:commentId", validateParam("commentId"), commentController.update);
  router.delete("/:commentId", validateParam("commentId"), commentController.remove);
  return router;
};