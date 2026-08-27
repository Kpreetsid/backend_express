import { Router } from 'express';
import { commentController } from './comment.controller';
import { validateParam, validateParamId } from '../../middlewares/validate';
import { commentValidator } from './comment.validator';
import { validate } from '../../middlewares/validator.middleware';
<<<<<<< Updated upstream
=======
import { hasRolePermission } from '../../middlewares/permission';
>>>>>>> Stashed changes

export default (router: Router) => {
  router.use(validateParamId); // Validate inherited order id
  router.get("/", commentController.getAll);
  router.get("/:commentId", validateParam("commentId"), commentController.getDataById);
<<<<<<< Updated upstream
  router.post("/", commentValidator, validate, commentController.create);
  router.put("/:commentId", validateParam("commentId"), commentValidator, validate, commentController.update);
  router.patch("/:commentId", validateParam("commentId"), commentValidator, validate, commentController.update);
  router.delete("/:commentId", validateParam("commentId"), commentController.remove);
  return router;
};

=======
  router.post("/", hasRolePermission('workOrder', 'add_comment_work_order'), commentValidator, validate, commentController.create);
  router.put("/:commentId", validateParam("commentId"), hasRolePermission('workOrder', 'add_comment_work_order'), commentValidator, validate, commentController.update);
  router.patch("/:commentId", validateParam("commentId"), hasRolePermission('workOrder', 'add_comment_work_order'), commentValidator, validate, commentController.update);
  router.delete("/:commentId", validateParam("commentId"), hasRolePermission('workOrder', 'add_comment_work_order'), commentController.remove);
  return router;
};
>>>>>>> Stashed changes
