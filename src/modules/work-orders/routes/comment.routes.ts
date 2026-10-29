import { Router } from 'express';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';
import { commentController } from '../controllers/comment.controller';
import { validateParam, validateParamId } from '../../../common/middlewares/validate.middleware';
import { commentValidator } from '../validators/comment.validator';
import { validate } from '../../../common/middlewares/validator.middleware';

export default (router: Router) => {
  router.use(validateParamId); // Validate inherited order id
  router.use(hasRolePermission('workOrder', 'view'));
  router.get("/", commentController.getAll);
  router.get("/:commentId", validateParam("commentId"), commentController.getDataById);
  router.post("/", hasRolePermission('workOrder', 'add_comment_work_order'), commentValidator, validate, commentController.create);
  router.put("/:commentId", validateParam("commentId"), hasRolePermission('workOrder', 'edit_comment_work_order'), commentValidator, validate, commentController.update);
  router.patch("/:commentId", validateParam("commentId"), hasRolePermission('workOrder', 'edit_comment_work_order'), commentValidator, validate, commentController.update);
  router.delete("/:commentId", validateParam("commentId"), hasRolePermission('workOrder', 'delete_comment_work_order'), commentController.remove);
  return router;
};

