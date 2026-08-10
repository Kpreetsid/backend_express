import { Router } from 'express';
import { commentController } from './comment.controller';
import { validateParam, validateParamId } from '../../middlewares/validate';
import { commentValidator } from './comment.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasAccountFeature } from '../../middlewares/permission';

export default (router: Router) => {
  router.use(validateParamId); // Validate inherited order id
  router.get("/", commentController.getAll);
  router.get("/:commentId", validateParam("commentId"), commentController.getDataById);
  router.post("/", hasAccountFeature('comment_work_order', 'add'), commentValidator, validate, commentController.create);
  router.put("/:commentId", hasAccountFeature('comment_work_order', 'edit'), validateParam("commentId"), commentValidator, validate, commentController.update);
  router.patch("/:commentId", hasAccountFeature('comment_work_order', 'edit'), validateParam("commentId"), commentValidator, validate, commentController.update);
  router.delete("/:commentId", hasAccountFeature('comment_work_order', 'delete'), validateParam("commentId"), commentController.remove);
  return router;
};
